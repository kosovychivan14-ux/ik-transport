"""Durable secret storage for Vercel serverless functions: Vercel KV
(Upstash Redis REST) + Fernet envelope. Stdlib except `cryptography`.

Env (Vercel):
  KV_REST_API_URL, KV_REST_API_TOKEN  -- auto-injected when KV is connected
  TOKEN_ENVELOPE_KEY                  -- Fernet key (urlsafe-b64), shared with
                                         the agency VM so it can decrypt.

Key layout (all under `kokos:` prefix):
  kokos:sec:{CODE}:{network}__{name}  -- Fernet-encrypted secret blob
  kokos:idx:{CODE}                    -- SET of secret names for the client
  kokos:uid:{meta_user_id}            -- CODE (data-deletion lookup)
  kokos:reg:{CODE}                    -- JSON registry metadata (no secrets)
"""
import base64
import json
import os
import urllib.parse
import urllib.request

PREFIX = "kokos:"


def _env(name):
    v = os.environ.get(name, "").strip()
    if not v:
        raise RuntimeError("missing env var: %s" % name)
    return v


def envelope_key_bytes():
    return _env("TOKEN_ENVELOPE_KEY").encode()


def _fernet():
    from cryptography.fernet import Fernet
    return Fernet(envelope_key_bytes())


def generate_envelope_key():
    from cryptography.fernet import Fernet
    return Fernet.generate_key().decode()


class KV:
    """Minimal Upstash Redis REST client (urllib only)."""

    def __init__(self, url=None, token=None):
        self.url = (url or _env("KV_REST_API_URL")).rstrip("/")
        self.token = token or _env("KV_REST_API_TOKEN")

    def _call(self, *parts):
        path = "/".join(urllib.parse.quote(str(p), safe="") for p in parts)
        req = urllib.request.Request(
            "%s/%s" % (self.url, path),
            headers={"Authorization": "Bearer %s" % self.token},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise RuntimeError("KV HTTP %s: %s"
                               % (e.code, e.read().decode("utf-8", "replace")[:200]))
        if isinstance(data, dict) and "error" in data:
            raise RuntimeError("KV error: %s" % data["error"])
        return data.get("result") if isinstance(data, dict) else data

    def get(self, key):
        return self._call("GET", key)

    def set(self, key, value):
        r = self._call("SET", key, value)
        if r != "OK":
            raise RuntimeError("KV SET failed: %r" % (r,))

    def delete(self, *keys):
        if keys:
            self._call("DEL", *keys)

    def sadd(self, key, *members):
        if members:
            self._call("SADD", key, *members)

    def smembers(self, key):
        return self._call("SMEMBERS", key) or []

    def rpush(self, key, *values):
        if values:
            self._call("RPUSH", key, *values)

    def lrange(self, key, start=0, stop=-1):
        return self._call("LRANGE", key, start, stop) or []


def _sec_key(code, network, name):
    safe = "".join(c for c in name if c.isalnum() or c in "-_") or "secret"
    return "%ssec:%s:%s__%s" % (PREFIX, code.upper(), network, safe)


def _idx_key(code):
    return "%sidx:%s" % (PREFIX, code.upper())


def _uid_key(user_id):
    return "%suid:%s" % (PREFIX, user_id)


def _reg_key(code):
    return "%sreg:%s" % (PREFIX, code.upper())


class SecretKV:
    """SecretsStore-compatible interface backed by Vercel KV."""

    def __init__(self, kv=None):
        self.kv = kv or KV()
        self._fernet = _fernet()

    def put(self, code, network, name, value):
        blob = self._fernet.encrypt(json.dumps({"v": value}).encode()).decode()
        key = _sec_key(code, network, name)
        self.kv.set(key, blob)
        self.kv.sadd(_idx_key(code), "%s__%s" % (network, name))

    def get(self, code, network, name):
        blob = self.kv.get(_sec_key(code, network, name))
        if blob is None:
            raise KeyError("no secret %s/%s for %s" % (network, name, code))
        return json.loads(self._fernet.decrypt(blob.encode()).decode())["v"]

    def delete(self, code, network, name):
        self.kv.delete(_sec_key(code, network, name))

    def list_names(self, code):
        return sorted(self.kv.smembers(_idx_key(code)))

    def delete_network(self, code, network):
        """Delete all secrets of one network for a client. Returns count."""
        names = [n for n in self.list_names(code) if n.startswith(network + "__")]
        for n in names:
            net, name = n.split("__", 1)
            self.kv.delete(_sec_key(code, net, name))
        return len(names)

    # -- meta user_id <-> client mapping (data deletion) --
    def map_user(self, user_id, code):
        if user_id:
            self.kv.set(_uid_key(user_id), code.upper())

    def unmap_user(self, user_id):
        if user_id:
            self.kv.delete(_uid_key(user_id))

    def code_for_user(self, user_id):
        return self.kv.get(_uid_key(user_id)) if user_id else None

    # -- registry metadata (no secrets) --
    def reg_get(self, code):
        raw = self.kv.get(_reg_key(code))
        return json.loads(raw) if raw else {"name": code.upper(), "networks": {}}

    def reg_set_network(self, code, network, **fields):
        import datetime
        reg = self.reg_get(code)
        nets = reg.setdefault("networks", {})
        rec = nets.setdefault(network, {"status": "never"})
        rec.update(fields)
        rec["updated_at"] = datetime.datetime.now(
            datetime.timezone.utc).isoformat()
        self.kv.set(_reg_key(code), json.dumps(reg, ensure_ascii=False))
        return rec


def log_audit(kv, code, action, network=None, details=None):
    """Append-only audit trail in KV. Never pass secret values in details."""
    import datetime
    day = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    rec = {"ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
           "client": (code or "-").upper(), "action": action,
           "network": network, "details": details or {}}
    kv.rpush("%saudit:%s" % (PREFIX, day), json.dumps(rec, ensure_ascii=False))
