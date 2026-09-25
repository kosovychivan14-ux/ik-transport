"""Signed `state` tokens (CSRF protection for the OAuth flow) + Ukrainian
HTML pages. Stdlib only."""
import hashlib
import hmac
import html
import time

from kv import envelope_key_bytes

STATE_TTL = 900  # seconds


def _sig(msg):
    return hmac.new(b"oauth-state|" + envelope_key_bytes(), msg.encode(),
                    hashlib.sha256).hexdigest()[:32]


def make_state(client_code, ttl=STATE_TTL):
    exp = int(time.time()) + ttl
    msg = "v1.%s.%d" % (client_code.upper(), exp)
    return "%s.%s" % (msg, _sig(msg))


def parse_state(state):
    """Return client code or None (bad signature / expired / bad shape)."""
    try:
        parts = (state or "").split(".")
        if len(parts) != 4 or parts[0] != "v1":
            return None
        _, code, exp, sig = parts
        if not hmac.compare_digest(_sig("v1.%s.%s" % (code, exp)), sig):
            return None
        if int(exp) < time.time():
            return None
        if not code or not all(c.isalnum() or c in "-_" for c in code):
            return None
        return code.upper()
    except Exception:
        return None


CSS = ("body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;"
       "max-width:640px;margin:8vh auto;padding:0 20px;color:#1c1e21;"
       "line-height:1.6}h1{font-size:24px}.ok{color:#0a7d2c}.err{color:#b3261e}"
       ".card{border:1px solid #ddd;border-radius:12px;padding:24px}"
       "a{color:#0866ff}")


def _doc(title, body):
    return ("<!doctype html><html lang='uk'><head><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<title>%s</title><style>%s</style></head>"
            "<body><div class='card'><h1>%s</h1>%s</div></body></html>"
            % (html.escape(title), CSS, html.escape(title), body))


def success_page(client):
    return _doc("Підключено",
                "<p class='ok'><b>Готово!</b> Акаунт підключено до "
                "Kokos AI Agency.</p>"
                "<p>Клієнт: <b>%s</b>. Тепер ми можемо публікувати пости за "
                "розкладом і відповідати на коментарі від вашого імені.</p>"
                "<p>Це вікно можна закрити.</p>" % html.escape(client))


def denied_page():
    return _doc("Доступ не надано",
                "<p class='err'><b>Ви натиснули «Не дозволяти».</b></p>"
                "<p>Без доступу ми не зможемо публікувати пости від вашого "
                "імені. Якщо це була помилка — попросіть нове посилання для "
                "підключення.</p>")


def error_page(text):
    return _doc("Помилка підключення",
                "<p class='err'><b>Не вдалося завершити підключення.</b></p>"
                "<p>%s</p><p>Спробуйте ще раз або зверніться до підтримки.</p>"
                % html.escape(text))
