"""Vercel serverless: рекламні кабінети і сторінки клієнта.

GET /api/client/adaccounts?client=CODE -> JSON зі списками (токен назовні не йде).
Бот показує їх кнопками, клієнт вибирає кабінет для реклами.

Деплой: скопіювати в api/client/adaccounts.py репо (поруч лежить _lib/).
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "_lib"))
import kv as kvmod
import oauth_meta


def _graph(token, path, fields):
    params = {"fields": fields, "access_token": token, "limit": 50}
    url = "%s/%s/%s?%s" % (oauth_meta.FB_GRAPH, oauth_meta.FB_VERSION,
                           path, urllib.parse.urlencode(params))
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError("Graph HTTP %s: %s" % (e.code, body[:200]))


def shape_result(adacc_raw, pages_raw, scopes):
    """Чиста функція: сирі відповіді Graph -> компактний JSON для бота."""
    accounts = [
        {"id": a.get("id"), "name": a.get("name"),
         "status": a.get("account_status")}
        for a in (adacc_raw.get("data") or [])
    ]
    pages = [
        {"id": p.get("id"), "name": p.get("name")}
        for p in (pages_raw.get("data") or [])
    ]
    return {
        "ok": True,
        "ad_accounts": accounts,
        "pages": pages,
        "has_ads_scope": "ads_read" in (scopes or ""),
    }


class handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        code = (q.get("client", [""])[0] or "").upper()
        if not code:
            self._json(400, {"ok": False, "error": "client required"})
            return
        try:
            store = kvmod.SecretKV()
        except RuntimeError:
            self._json(500, {"ok": False, "error": "server misconfigured"})
            return
        try:
            token = store.get(code, "meta", "user_token")
        except KeyError:
            self._json(404, {"ok": False, "error": "meta not connected"})
            return
        try:
            reg = store.reg_get(code)
            scopes = (reg.get("networks") or {}).get("meta", {}).get("scopes", "")
            adacc = _graph(token, "me/adaccounts", "id,name,account_status")
            pages = _graph(token, "me/accounts", "id,name")
            self._json(200, shape_result(adacc, pages, scopes))
        except Exception as e:
            self._json(502, {"ok": False, "error": str(e)[:160]})
