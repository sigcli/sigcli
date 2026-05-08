#!/usr/bin/env python3
"""Xiaohongshu API client with request signing.

Signing algorithm ported from ReaJason/xhs (MIT license).
Generates x-s, x-t, x-s-common headers required by XHS API.
"""

import hashlib
import json
import os
import re
import time
import urllib.parse
from typing import Any, Dict, Optional

import requests

API_BASE = "https://edith.xiaohongshu.com"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
)

# Custom base64 lookup table used by XHS
_LOOKUP = "ZmserbBo4IjhFGNKRWkPcOx/T0Y71UfnV+QLqDpgi6odSAyw5at2X9CJlE3Hzu8M"


class XhsApiError(Exception):
    def __init__(self, code: int, msg: str):
        self.code = code
        self.msg = msg
        super().__init__(f"XHS API error {code}: {msg}")


# =============================================================================
# Signing
# =============================================================================


def _md5(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def _h(text: str) -> str:
    """Custom encoding of MD5 hash using XHS character substitution."""
    mapping = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    result = []
    for i in range(0, len(text), 3):
        chunk = text[i : i + 3]
        n = 0
        for j, c in enumerate(chunk):
            n |= ord(c) << (16 - j * 8)
        for j in range(4):
            if j * 6 > len(chunk) * 8:
                result.append("=")
            else:
                result.append(mapping[(n >> (18 - j * 6)) & 63])
    return "".join(result)


def _encode_utf8(text: str) -> bytes:
    """URL-encode then convert to bytes."""
    encoded = urllib.parse.quote(text, safe="")
    result = bytearray()
    i = 0
    while i < len(encoded):
        if encoded[i] == "%":
            result.append(int(encoded[i + 1 : i + 3], 16))
            i += 3
        else:
            result.append(ord(encoded[i]))
            i += 1
    return bytes(result)


def _b64_encode(data: bytes) -> str:
    """Base64 encode using XHS custom alphabet."""
    result = []
    for i in range(0, len(data), 3):
        chunk = data[i : i + 3]
        n = 0
        for j, b in enumerate(chunk):
            n |= b << (16 - j * 8)
        for j in range(4):
            if j <= len(chunk):
                result.append(_LOOKUP[(n >> (18 - j * 6)) & 63])
            else:
                result.append("=")
    return "".join(result)


def sign(uri: str, data: Optional[str] = None, a1: str = "") -> Dict[str, str]:
    """Generate x-s, x-t, x-s-common headers for XHS API request."""
    t = str(int(time.time() * 1000))

    # x-s: MD5-based signature
    raw = f"{t}test{uri}{data or ''}"
    md5_hash = _md5(raw)
    xs = f"XYW_{_h(md5_hash)}"

    # x-s-common: platform metadata encoded with custom base64
    common_dict = {
        "s0": 3,  # platform (web)
        "s1": "",
        "x0": "1",  # app ID
        "x1": "3.8.7",  # version
        "x2": "Windows",
        "x3": "xhs-pc-web",
        "x4": "4.30.3",
        "x5": a1,
        "x6": t,
        "x7": xs,
        "x8": "",
        "x9": "",
        "x10": "",
    }
    common_json = json.dumps(common_dict, separators=(",", ":"))
    common_bytes = _encode_utf8(common_json)
    xs_common = _b64_encode(common_bytes)

    return {"x-s": xs, "x-t": t, "x-s-common": xs_common}


# =============================================================================
# Client
# =============================================================================


class XhsClient:
    """Xiaohongshu API client with automatic request signing."""

    def __init__(self, cookie: str = ""):
        self.cookie = cookie
        self._session = requests.Session()
        self._a1 = self._extract_cookie_value(cookie, "a1")
        self._session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Origin": "https://www.xiaohongshu.com",
                "Referer": "https://www.xiaohongshu.com/",
            }
        )
        if cookie:
            self._session.headers["Cookie"] = cookie

    @classmethod
    def create(cls) -> "XhsClient":
        """Create client from SIG_XIAOHONGSHU_COOKIE env var."""
        cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
        return cls(cookie)

    def require_cookie(self):
        if not self.cookie or not self._a1:
            raise XhsApiError(-1, "AUTH_REQUIRED")

    def get(self, uri: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Signed GET request."""
        if params:
            query = urllib.parse.urlencode(params)
            full_uri = f"{uri}?{query}"
        else:
            full_uri = uri

        signs = sign(full_uri, None, a1=self._a1)
        headers = {"x-s": signs["x-s"], "x-t": signs["x-t"], "x-s-common": signs["x-s-common"]}

        resp = self._session.get(f"{API_BASE}{full_uri}", headers=headers, timeout=15)
        return self._handle_response(resp)

    def post(self, uri: str, data: Dict) -> Dict[str, Any]:
        """Signed POST request."""
        body = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
        signs = sign(uri, body, a1=self._a1)
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "x-s": signs["x-s"],
            "x-t": signs["x-t"],
            "x-s-common": signs["x-s-common"],
        }

        resp = self._session.post(f"{API_BASE}{uri}", headers=headers, data=body, timeout=15)
        return self._handle_response(resp)

    def _handle_response(self, resp: requests.Response) -> Dict[str, Any]:
        if resp.status_code == 461:
            raise XhsApiError(461, "Signature rejected — signing algorithm may need update")
        resp.raise_for_status()
        result = resp.json()
        if not result.get("success") and result.get("code", 0) != 0:
            raise XhsApiError(result.get("code", -1), result.get("msg", "Unknown error"))
        return result

    @staticmethod
    def _extract_cookie_value(cookie: str, name: str) -> str:
        match = re.search(rf"{name}=([^;]+)", cookie)
        return match.group(1) if match else ""
