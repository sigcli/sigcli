#!/usr/bin/env python3
"""Shared Xiaohongshu client for XHS skill scripts.

Handles HTTP transport with xhshow signing, cookie management,
anti-detection measures, and response normalization.

Key differences from naive xhshow usage (learned from xiaohongshu-cli):
  - CryptoConfig with proper SIGNATURE_DATA/XSCOMMON templates
  - SessionManager for consistent session fingerprint
  - sec-ch-ua and sec-fetch-* browser fingerprint headers
  - Compact JSON serialization (no spaces) for POST body
  - Self-generated search_id (base36 encoded)
"""

from __future__ import annotations

import json
import os
import random
import time

import execjs
import requests
from xhshow import CryptoConfig, SessionManager, Xhshow

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

XHS_API = "https://edith.xiaohongshu.com"
HOME_URL = "https://www.xiaohongshu.com"
CHROME_VERSION = "145"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    f"Chrome/{CHROME_VERSION}.0.0.0 Safari/537.36"
)
SDK_VERSION = "4.2.6"
APP_ID = "xhs-pc-web"
PLATFORM = "macOS"
TIMEOUT = 15
MAX_RETRIES = 3
RETRY_BACKOFF = 2.0


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class XhsApiError(Exception):
    """Raised when XHS returns an unexpected response."""

    def __init__(self, code: str, message: str = ""):
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def error_response(code: str, message: str) -> dict:
    """Build a standard error dict for JSON output."""
    return {"error": code, "message": message}


# ---------------------------------------------------------------------------
# Signing setup (matches xiaohongshu-cli configuration)
# ---------------------------------------------------------------------------

_crypto_config = CryptoConfig().with_overrides(
    PUBLIC_USERAGENT=USER_AGENT,
    SIGNATURE_DATA_TEMPLATE={
        "x0": SDK_VERSION,
        "x1": APP_ID,
        "x2": PLATFORM,
        "x3": "",
        "x4": "",
    },
    SIGNATURE_XSCOMMON_TEMPLATE={
        "s0": 5,
        "s1": "",
        "x0": "1",
        "x1": SDK_VERSION,
        "x2": PLATFORM,
        "x3": APP_ID,
        "x4": "4.86.0",
        "x5": "",
        "x6": "",
        "x7": "",
        "x8": "",
        "x9": -596800761,
        "x10": 0,
        "x11": "normal",
    },
)

_xhshow = Xhshow(_crypto_config)
_session_mgr = SessionManager(_crypto_config)


# ---------------------------------------------------------------------------
# x-rap-param generation (via bundled JS, required for GET requests)
# ---------------------------------------------------------------------------

_STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
_RAP_JS = None


def _get_rap_js():
    global _RAP_JS
    if _RAP_JS is None:
        js_path = os.path.join(_STATIC_DIR, "xhs_rap.js")
        with open(js_path, "r", encoding="utf-8") as f:
            _RAP_JS = execjs.compile(f.read())
    return _RAP_JS


def generate_x_rap_param(api: str, data: str = "", app_id: str | None = None) -> str:
    """Generate x-rap-param header value via JS execution."""
    return _get_rap_js().call("generate_x_rap_param", api, data or "", app_id)


# ---------------------------------------------------------------------------
# XHS API client
# ---------------------------------------------------------------------------


class XhsClient:
    """HTTP client for Xiaohongshu's web API with xhshow signing."""

    def __init__(self, cookie_str: str, a1: str, web_session: str, web_id: str):
        self.cookie_str = cookie_str
        # sign_cookies must include ALL cookies for x-s-common generation
        self.sign_cookies = self._parse_cookie_str(cookie_str)
        # Ensure critical keys are present (from explicit env vars as fallback)
        self.sign_cookies.setdefault("a1", a1)
        self.sign_cookies.setdefault("web_session", web_session)
        self.sign_cookies.setdefault("webId", web_id)
        self._session = requests.Session()
        self._session.headers.update(self._base_headers())

    @staticmethod
    def _parse_cookie_str(cookie_str: str) -> dict[str, str]:
        """Parse cookie header string into dict."""
        cookies = {}
        for part in cookie_str.split(";"):
            part = part.strip()
            if "=" in part:
                key, _, value = part.partition("=")
                cookies[key.strip()] = value.strip()
        return cookies

    @classmethod
    def create(cls) -> "XhsClient":
        """Create client from SIG_XIAOHONGSHU_* environment variables."""
        cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
        a1 = os.environ.get("SIG_XIAOHONGSHU_A1", "")
        web_session = os.environ.get("SIG_XIAOHONGSHU_WEB_SESSION", "")
        web_id = os.environ.get("SIG_XIAOHONGSHU_WEBID", "")
        if not cookie or not a1:
            raise XhsApiError(
                "AUTH_REQUIRED",
                "Xiaohongshu session required. Run: sig login xiaohongshu",
            )
        return cls(cookie, a1, web_session, web_id)

    def get(self, path: str, params: dict | None = None) -> dict:
        """Signed GET request to XHS API."""
        params = dict(params or {})
        try:
            sign_headers = _xhshow.sign_headers_get(
                uri=path, cookies=self.sign_cookies, params=params, session=_session_mgr
            )
        except Exception as e:
            raise XhsApiError("SIGN_FAILED", f"Signing failed: {e}. Try: pip install --upgrade xhshow")
        full_uri = _xhshow.build_url(path, params) if params else path
        url = f"{XHS_API}{full_uri}"
        # x-rap-param required for GET requests (platform anti-bot since 2026-04)
        rap_param = generate_x_rap_param(full_uri, "")
        headers = {**sign_headers, "cookie": self.cookie_str, "x-rap-param": rap_param}
        return self._request("GET", url, headers=headers)

    def post(self, path: str, payload: dict | None = None) -> dict:
        """Signed POST request to XHS API."""
        payload = payload or {}
        try:
            sign_headers = _xhshow.sign_headers_post(
                uri=path, cookies=self.sign_cookies, payload=payload, session=_session_mgr
            )
        except Exception as e:
            raise XhsApiError("SIGN_FAILED", f"Signing failed: {e}. Try: pip install --upgrade xhshow")
        url = f"{XHS_API}{path}"
        # Compact JSON with no spaces, utf-8 encoded — required by XHS signature verification
        body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        # x-rap-param required for business APIs (search, feed, interactions)
        rap_param = generate_x_rap_param(path, body.decode("utf-8"))
        headers = {**sign_headers, "cookie": self.cookie_str, "x-rap-param": rap_param}
        return self._request("POST", url, headers=headers, content=body)

    def require_auth(self):
        """Assert that auth credentials are present."""
        if not self.cookie_str or not self.sign_cookies.get("a1"):
            raise XhsApiError(
                "AUTH_REQUIRED",
                "Xiaohongshu session required. Run: sig login xiaohongshu",
            )

    def _base_headers(self) -> dict[str, str]:
        """Browser fingerprint headers matching Chrome on macOS."""
        return {
            "user-agent": USER_AGENT,
            "content-type": "application/json;charset=UTF-8",
            "origin": HOME_URL,
            "referer": f"{HOME_URL}/",
            "sec-ch-ua": f'"Not:A-Brand";v="99", "Google Chrome";v="{CHROME_VERSION}", "Chromium";v="{CHROME_VERSION}"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "accept": "application/json, text/plain, */*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
            "dnt": "1",
            "priority": "u=1, i",
        }

    def _request(self, method: str, url: str, **kwargs) -> dict:
        """Execute request with retry on 429 and jitter."""
        self._jitter()
        req_headers = dict(self._session.headers)
        req_headers.update(kwargs.pop("headers", {}))

        for attempt in range(MAX_RETRIES):
            if "content" in kwargs:
                resp = self._session.request(
                    method, url, headers=req_headers, data=kwargs["content"], timeout=TIMEOUT
                )
            else:
                resp = self._session.request(
                    method, url, headers=req_headers, timeout=TIMEOUT
                )

            if resp.status_code == 429:
                wait = RETRY_BACKOFF * (2 ** attempt) + random.uniform(0, 1)
                time.sleep(wait)
                continue
            if resp.status_code in (461, 471):
                raise XhsApiError("CAPTCHA_REQUIRED", "Captcha triggered. Wait a few minutes and retry.")
            if resp.status_code in (401, 403):
                raise XhsApiError("SESSION_EXPIRED", "Session expired. Run: sig login xiaohongshu")
            if resp.status_code == 406:
                raise XhsApiError("SIGN_FAILED", "Request rejected (406). Signature may be invalid.")

            resp.raise_for_status()
            data = resp.json()
            return self._check_api_response(data)

        raise XhsApiError("RATE_LIMITED", "Rate limited after retries. Wait and retry later.")

    def _check_api_response(self, data: dict) -> dict:
        """Check XHS API response envelope for errors."""
        if not isinstance(data, dict):
            return data

        # success=true means OK
        if data.get("success"):
            return data.get("data", data)

        code = data.get("code")
        if code is None:
            return data
        if code == 0 or code == "0":
            return data.get("data", data)
        if code in (-101, "-101", -100):
            raise XhsApiError("SESSION_EXPIRED", "Session expired. Run: sig login xiaohongshu")
        if code == 300015:
            raise XhsApiError("SIGN_FAILED", "Signature rejected. Try: pip install --upgrade xhshow")
        msg = data.get("msg", "") or data.get("message", "") or f"API error code: {code}"
        raise XhsApiError("API_ERROR", msg)

    def _jitter(self):
        """Anti-detection: Gaussian random delay between requests."""
        delay = max(0.3, random.gauss(1.0, 0.3))
        if random.random() < 0.05:
            delay += random.uniform(2.0, 4.0)
        time.sleep(delay)


# ---------------------------------------------------------------------------
# Response parsers
# ---------------------------------------------------------------------------


def parse_note_brief(item: dict) -> dict:
    """Parse a note item from search results or feed into brief format."""
    note_card = item.get("note_card", item)
    user = note_card.get("user", {})
    interact = note_card.get("interact_info", {})
    return {
        "note_id": item.get("id", "") or note_card.get("note_id", ""),
        "xsec_token": item.get("xsec_token", ""),
        "title": note_card.get("display_title", ""),
        "type": note_card.get("type", "normal"),
        "author": user.get("nickname", ""),
        "author_id": user.get("user_id", ""),
        "liked_count": interact.get("liked_count", "0"),
        "cover": note_card.get("cover", {}).get("url_default", ""),
    }


def parse_note_detail(note: dict) -> dict:
    """Parse a full note detail response."""
    user = note.get("user", {})
    interact = note.get("interact_info", {})
    image_list = note.get("image_list", [])
    video = note.get("video", {})
    tags = [t.get("name", "") for t in note.get("tag_list", [])]
    return {
        "note_id": note.get("note_id", ""),
        "title": note.get("title", ""),
        "desc": note.get("desc", ""),
        "type": note.get("type", "normal"),
        "author": user.get("nickname", ""),
        "author_id": user.get("user_id", ""),
        "liked_count": interact.get("liked_count", "0"),
        "collected_count": interact.get("collected_count", "0"),
        "comment_count": interact.get("comment_count", "0"),
        "share_count": interact.get("share_count", "0"),
        "images": [img.get("url_default", "") for img in image_list],
        "video_url": video.get("consumer", {}).get("origin_video_key", "") if video else "",
        "tags": tags,
        "time": note.get("time", 0),
        "ip_location": note.get("ip_location", ""),
    }


def parse_comment(comment: dict) -> dict:
    """Parse a comment item."""
    user = comment.get("user_info", {})
    return {
        "comment_id": comment.get("id", ""),
        "author": user.get("nickname", ""),
        "author_id": user.get("user_id", ""),
        "content": comment.get("content", ""),
        "like_count": comment.get("like_count", "0"),
        "sub_comment_count": comment.get("sub_comment_count", "0"),
        "create_time": comment.get("create_time", 0),
        "ip_location": comment.get("ip_location", ""),
    }


def parse_user(user: dict) -> dict:
    """Parse a user profile response."""
    return {
        "user_id": user.get("user_id", ""),
        "nickname": user.get("nickname", ""),
        "desc": user.get("desc", ""),
        "gender": user.get("gender", 0),
        "avatar": user.get("imageb", "") or user.get("image", ""),
        "ip_location": user.get("ip_location", ""),
        "fans": user.get("fans", "0"),
        "follows": user.get("follows", "0"),
        "interaction": user.get("interaction", "0"),
        "level": user.get("level", {}).get("name", ""),
    }
