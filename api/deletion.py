"""Vercel serverless: Meta Data Deletion callback.

Meta POSTs `signed_request`. We verify the HMAC-SHA256 signature with the
app secret, delete every stored token for the matching user and answer with
{url, confirmation_code} as Meta requires.
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import urllib.parse
import uuid
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib")))
import kv as kvmod

DELETION_INFO = os.environ.get(
    "DELETION_INFO_URL",
    "https://ik-transport.vercel.app/agency/data-deletion/")


def _b64url_decode(s):
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s.encode())


def parse_signed_request(app_secret, signed_request):
    try:
        sig_b64, payload_b64 = signed_request.split(".", 1)
    except ValueError:
        raise ValueError("bad signed_request shape")
    expected = hmac.new(app_secret.encode(), payload_b64.encode(),
                        hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _b64url_decode(sig_b64)):
        raise ValueError("signed_request signature mismatch")
    return json.loads(_b64url_decode(payload_b64).decode("utf-8"))


class handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, status, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        # Meta only uses POST; a GET probe gets a hint, not an error page.
        self._json(200, {"ok": True, "usage": "POST signed_request"})

    def do_POST(self):
        try:
            store = kvmod.SecretKV()
        except RuntimeError:
            self._json(500, {"error": "not_configured"})
            return
        app_secret = os.environ.get("META_APP_SECRET", "")
        if not app_secret:
            self._json(500, {"error": "not_configured"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            raw = self.rfile.read(min(length, 65536)).decode("utf-8", "replace")
            q = urllib.parse.parse_qs(raw)
            payload = parse_signed_request(
                app_secret, q.get("signed_request", [""])[0])
        except Exception:
            self._json(400, {"error": "bad_signature"})
            return
        user_id = str(payload.get("user_id", ""))
        code = store.code_for_user(user_id)
        if code:
            store.delete_network(code, "meta")
            store.unmap_user(user_id)
            store.reg_set_network(code, "meta", status="revoked",
                                  revoke_reason="data_deletion")
        confirm = uuid.uuid4().hex
        kvmod.log_audit(store.kv, code or "?", "tokens_deleted", "meta",
                        {"user_id": user_id, "confirmation": confirm})
        self._json(200, {"url": DELETION_INFO, "confirmation_code": confirm})
