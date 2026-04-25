#!/usr/bin/env python3
"""Shared Bilibili client for Bilibili skill scripts.

Handles HTTP transport with WBI signing, CSRF extraction,
and response normalization for Bilibili's web API.
"""

from __future__ import annotations

import hashlib
import os
import re
import time
import urllib.parse

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BILIBILI_API = "https://api.bilibili.com"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
TIMEOUT = 15

MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 34, 6, 11, 56, 20, 36, 21, 44, 57,
    59, 52, 54, 62, 63,
]

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class BilibiliApiError(Exception):
    """Raised when Bilibili returns an unexpected response."""

    def __init__(self, code: str, message: str = ""):
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def error_response(code: str, message: str) -> dict:
    """Build a standard error dict for JSON output."""
    return {"error": code, "message": message}


# ---------------------------------------------------------------------------
# WBI Signing
# ---------------------------------------------------------------------------


def _get_mixin_key(img_key: str, sub_key: str) -> str:
    raw = img_key + sub_key
    return "".join(raw[i] for i in MIXIN_KEY_ENC_TAB if i < len(raw))[:32]


def _wbi_sign(params: dict, img_key: str, sub_key: str) -> dict:
    mixin_key = _get_mixin_key(img_key, sub_key)
    wts = str(int(time.time()))
    all_params = {**params, "wts": wts}
    sorted_params = {}
    for key in sorted(all_params.keys()):
        sorted_params[key] = re.sub(r"[!'()*]", "", str(all_params[key]))
    query = urllib.parse.urlencode(sorted_params)
    w_rid = hashlib.md5((query + mixin_key).encode()).hexdigest()
    sorted_params["w_rid"] = w_rid
    return sorted_params


# ---------------------------------------------------------------------------
# Bilibili API client
# ---------------------------------------------------------------------------


class BilibiliClient:
    """HTTP client for Bilibili's web API with optional cookie auth."""

    def __init__(self, cookie: str = ""):
        self.cookie = cookie
        self._session = requests.Session()
        self._session.headers["User-Agent"] = USER_AGENT
        self._session.headers["Referer"] = "https://www.bilibili.com"
        if cookie:
            self._session.headers["Cookie"] = cookie
        self._img_key = ""
        self._sub_key = ""
        self._wbi_ts = 0.0

    @classmethod
    def create(cls) -> "BilibiliClient":
        cookie = os.environ.get("SIG_BILIBILI_COOKIE", "")
        return cls(cookie)

    def _ensure_wbi_keys(self):
        if self._img_key and (time.time() - self._wbi_ts) < 600:
            return
        resp = self._session.get(f"{BILIBILI_API}/x/web-interface/nav", timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json().get("data", {})
        wbi_img = data.get("wbi_img", {})
        img_url = wbi_img.get("img_url", "")
        sub_url = wbi_img.get("sub_url", "")
        self._img_key = img_url.split("/")[-1].split(".")[0] if img_url else ""
        self._sub_key = sub_url.split("/")[-1].split(".")[0] if sub_url else ""
        self._wbi_ts = time.time()

    def get(self, path: str, params: dict | None = None, signed: bool = False) -> dict:
        """GET a Bilibili API endpoint. Optionally signs with WBI."""
        params = dict(params or {})
        if signed:
            self._ensure_wbi_keys()
            params = _wbi_sign(params, self._img_key, self._sub_key)
        resp = self._session.get(f"{BILIBILI_API}{path}", params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    def post(self, path: str, data: dict | None = None) -> dict:
        """POST form-encoded data to a Bilibili API endpoint."""
        self.require_cookie()
        resp = self._session.post(f"{BILIBILI_API}{path}", data=data, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    def get_csrf(self) -> str:
        """Extract CSRF token (bili_jct) from cookie string."""
        self.require_cookie()
        match = re.search(r"bili_jct=([^;]+)", self.cookie)
        if not match:
            raise BilibiliApiError("NO_CSRF", "Cannot extract bili_jct CSRF token from cookie. Re-authenticate with: sig login https://www.bilibili.com/")
        return match.group(1)

    def require_cookie(self):
        if not self.cookie:
            raise BilibiliApiError(
                "AUTH_REQUIRED",
                "This operation requires a Bilibili session cookie. Run: sig login https://www.bilibili.com/",
            )


# ---------------------------------------------------------------------------
# Response parsers
# ---------------------------------------------------------------------------


def parse_video(data: dict) -> dict:
    """Normalize a Bilibili video data dict to output format."""
    stat = data.get("stat", {})
    owner = data.get("owner", {})
    dur = data.get("duration", 0)
    pub = data.get("pubdate", 0)
    return {
        "bvid": data.get("bvid", ""),
        "aid": data.get("aid", 0),
        "title": data.get("title", ""),
        "author": owner.get("name", ""),
        "author_mid": owner.get("mid", 0),
        "description": data.get("desc", ""),
        "duration": dur,
        "duration_text": f"{dur // 60}m{dur % 60}s" if dur else "",
        "thumbnail": data.get("pic", ""),
        "publish_time": pub,
        "view": stat.get("view", 0),
        "like": stat.get("like", 0),
        "coin": stat.get("coin", 0),
        "favorite": stat.get("favorite", 0),
        "share": stat.get("share", 0),
        "reply": stat.get("reply", 0),
        "danmaku": stat.get("danmaku", 0),
    }


def parse_comment(data: dict) -> dict:
    """Normalize a Bilibili comment data dict."""
    member = data.get("member", {})
    content = data.get("content", {})
    ctime = data.get("ctime", 0)
    return {
        "rpid": data.get("rpid", 0),
        "author": member.get("uname", ""),
        "author_mid": member.get("mid", 0),
        "text": content.get("message", ""),
        "like": data.get("like", 0),
        "replies": data.get("rcount", 0),
        "time": ctime,
    }
