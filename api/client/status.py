"""Vercel serverless: статус підключень клієнта.

GET /api/client/status?client=CODE -> JSON зі статусами мереж з реєстру.
Бот опитує цей endpoint, щоб дізнатися, що клієнт завершив OAuth.

Деплой: скопіювати в api/client/status.py репо (поруч лежить _lib/).
"""
import json
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "_lib"))
import kv as kvmod


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
        except RuntimeError as e:
            self._json(500, {"ok": False, "error": "server misconfigured"})
            return
        reg = store.reg_get(code)
        nets = {}
        for net, rec in (reg.get("networks") or {}).items():
            nets[net] = {
                "status": rec.get("status"),
                "scopes": rec.get("scopes", ""),
                "updated_at": rec.get("updated_at"),
            }
        self._json(200, {"ok": True, "client": code, "networks": nets})
