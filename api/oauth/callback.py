"""Vercel serverless: Meta (Facebook/Instagram) OAuth callback.

Meta redirects here with ?code=&state= -> we validate state, exchange the
code for a 60-day token and store it encrypted in Vercel KV.
"""
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "_lib"))
import kv as kvmod
import oauth_meta
import state_pages

PUBLIC_BASE = os.environ.get(
    "OAUTH_PUBLIC_BASE", "https://ik-transport.vercel.app").rstrip("/")


class handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _html(self, status, doc):
        body = doc.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        try:
            store = kvmod.SecretKV()
        except RuntimeError as e:
            self._html(500, state_pages.error_page(
                "Сервер не налаштовано: %s" % e))
            return
        if q.get("error"):
            kvmod.log_audit(store.kv, "?", "connect_denied", "meta",
                            {"error": q["error"][0][:80]})
            self._html(200, state_pages.denied_page())
            return
        code, st = q.get("code", [""])[0], q.get("state", [""])[0]
        client = state_pages.parse_state(st)
        if not client or not code:
            self._html(200, state_pages.error_page(
                "Недійсне посилання (прострочене або пошкоджене). "
                "Попросіть нове."))
            return
        app_id = os.environ.get("META_APP_ID", "")
        app_secret = os.environ.get("META_APP_SECRET", "")
        if not app_id or not app_secret:
            kvmod.log_audit(store.kv, client, "not_configured", "meta", {})
            self._html(500, state_pages.error_page(
                "Технічна пауза: секрет застосунку ще не внесено. "
                "Підключення запрацює найближчим часом."))
            return
        try:
            redir = PUBLIC_BASE + "/api/oauth/callback"
            short = oauth_meta.exchange_code(
                app_id, app_secret, redir, code)["access_token"]
            long_tok = oauth_meta.extend_token(
                app_id, app_secret, short)["access_token"]
            dbg = oauth_meta.debug_token(app_id, app_secret, long_tok)
            user_id = str(dbg.get("user_id") or "")
            store.put(client, "meta", "user_token", long_tok)
            store.put(client, "meta", "user_id", user_id)
            store.map_user(user_id, client)
            store.reg_set_network(
                client, "meta", status="connected",
                scopes=",".join(dbg.get("scopes") or []),
                user_id=user_id, token_expires_at=dbg.get("expires_at"))
            kvmod.log_audit(store.kv, client, "connected", "meta",
                            {"user_id": user_id})
            self._html(200, state_pages.success_page(client))
        except Exception as e:
            kvmod.log_audit(store.kv, client, "connect_failed", "meta",
                            {"error": str(e)[:120]})
            self._html(200, state_pages.error_page(
                "Meta відхилив обмін коду: %s" % str(e)[:160]))
