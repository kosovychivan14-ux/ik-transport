"""Vercel serverless: start Meta (Facebook/Instagram) OAuth connect.

GET /api/oauth/start?client=<CODE> -> 302 redirect to Meta's authorize dialog
with a freshly signed state. This is the public entry point a client opens
to connect their Facebook/Instagram to the agency.
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


def _valid_client(code):
    return bool(code) and all(c.isalnum() or c in "-_" for c in code)


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

    def _redirect(self, url):
        self.send_response(302)
        self.send_header("Location", url)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        client = (q.get("client", [""])[0] or "").upper()
        if not _valid_client(client):
            self._html(400, state_pages.error_page(
                "Недійсний код клієнта. Посилання має виглядати так: "
                "/api/oauth/start?client=ВАШ-КОД"))
            return
        try:
            store = kvmod.SecretKV()
        except RuntimeError as e:
            self._html(500, state_pages.error_page(
                "Сервер не налаштовано: %s" % e))
            return
        app_id = os.environ.get("META_APP_ID", "")
        if not app_id:
            kvmod.log_audit(store.kv, client, "not_configured", "meta", {})
            self._html(500, state_pages.error_page(
                "Технічна пауза: застосунок ще не налаштовано. "
                "Підключення запрацює найближчим часом."))
            return
        state = state_pages.make_state(client)
        redir = PUBLIC_BASE + "/api/oauth/callback"
        scopes = oauth_meta.SCOPES_PUBLISH + oauth_meta.SCOPES_ADS
        kvmod.log_audit(store.kv, client, "connect_started", "meta", {})
        self._redirect(oauth_meta.authorize_url(app_id, redir, scopes, state))
