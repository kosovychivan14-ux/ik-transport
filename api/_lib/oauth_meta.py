"""Meta (Facebook/Instagram/Threads) OAuth HTTP helpers for serverless.
Stdlib only. Secrets are parameters, never logged or persisted here.
"""
import json
import urllib.parse
import urllib.request

FB_GRAPH = "https://graph.facebook.com"
FB_VERSION = "v23.0"
FB_OAUTH = "https://www.facebook.com/" + FB_VERSION + "/dialog/oauth"

SCOPES_PUBLISH = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
]
SCOPES_ADS = ["ads_management", "business_management"]

THREADS_OAUTH = "https://threads.net/oauth/authorize"
THREADS_GRAPH = "https://graph.threads.net"
SCOPES_THREADS = ["threads_basic", "threads_content_publish"]


def _get_json(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError("Meta API HTTP %s: %s" % (e.code, body[:300]))


def _post_form(url, data):
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded",
                 "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError("Meta API HTTP %s: %s" % (e.code, body[:300]))


def _raise_if_error(data):
    err = data.get("error")
    if err:
        raise RuntimeError("Meta OAuth error %s: %s"
                           % (err.get("code"), err.get("message")))
    return data


def authorize_url(app_id, redirect_uri, scopes, state):
    params = {"client_id": app_id, "redirect_uri": redirect_uri,
              "scope": ",".join(scopes), "state": state,
              "response_type": "code"}
    return FB_OAUTH + "?" + urllib.parse.urlencode(params)


def threads_authorize_url(app_id, redirect_uri, state):
    params = {"client_id": app_id, "redirect_uri": redirect_uri,
              "scope": ",".join(SCOPES_THREADS), "response_type": "code",
              "state": state}
    return THREADS_OAUTH + "?" + urllib.parse.urlencode(params)


def exchange_code(app_id, app_secret, redirect_uri, code):
    params = {"client_id": app_id, "client_secret": app_secret,
              "redirect_uri": redirect_uri, "code": code}
    url = FB_GRAPH + "/" + FB_VERSION + "/oauth/access_token?" + \
        urllib.parse.urlencode(params)
    return _raise_if_error(_get_json(url))


def extend_token(app_id, app_secret, short_token):
    params = {"grant_type": "fb_exchange_token", "client_id": app_id,
              "client_secret": app_secret, "fb_exchange_token": short_token}
    url = FB_GRAPH + "/" + FB_VERSION + "/oauth/access_token?" + \
        urllib.parse.urlencode(params)
    return _raise_if_error(_get_json(url))


def debug_token(app_id, app_secret, user_token):
    params = {"input_token": user_token,
              "access_token": "%s|%s" % (app_id, app_secret)}
    url = FB_GRAPH + "/" + FB_VERSION + "/debug_token?" + \
        urllib.parse.urlencode(params)
    d = _raise_if_error(_get_json(url)).get("data", {})
    return {"is_valid": bool(d.get("is_valid")),
            "scopes": d.get("scopes", []),
            "expires_at": d.get("expires_at"),
            "user_id": d.get("user_id")}


def threads_exchange_code(app_id, app_secret, redirect_uri, code):
    return _raise_if_error(_post_form(
        THREADS_GRAPH + "/oauth/access_token",
        {"client_id": app_id, "client_secret": app_secret,
         "grant_type": "authorization_code",
         "redirect_uri": redirect_uri, "code": code}))


def threads_extend_token(app_secret, short_token):
    params = {"grant_type": "th_exchange_token",
              "client_secret": app_secret, "access_token": short_token}
    url = THREADS_GRAPH + "/access_token?" + urllib.parse.urlencode(params)
    return _raise_if_error(_get_json(url))
