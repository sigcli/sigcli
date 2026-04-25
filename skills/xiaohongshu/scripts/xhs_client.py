#!/usr/bin/env python3
"""Shared Xiaohongshu client for XHS skill scripts.

Handles HTTP transport with cookie auth, HTML SSR parsing,
and web API requests for Xiaohongshu (小红书).
"""

from __future__ import annotations

import json
import os
import re

import requests

XHS_WEB = "https://www.xiaohongshu.com"
XHS_API = "https://edith.xiaohongshu.com"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
TIMEOUT = 15


class XhsApiError(Exception):
    def __init__(self, code: str, message: str = ""):
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def error_response(code: str, message: str) -> dict:
    return {"error": code, "message": message}


class XhsClient:
    """HTTP client for Xiaohongshu with cookie-based auth.

    Read operations parse SSR HTML for embedded __INITIAL_STATE__ JSON.
    Write operations use the web API at edith.xiaohongshu.com.
    """

    def __init__(self, cookie: str = ""):
        self.cookie = cookie
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.xiaohongshu.com/",
        })
        if cookie:
            self._session.headers["Cookie"] = cookie

    @classmethod
    def create(cls) -> "XhsClient":
        cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
        return cls(cookie)

    def require_cookie(self):
        if not self.cookie:
            raise XhsApiError("AUTH_REQUIRED", "This operation requires a Xiaohongshu session cookie. Run: sig login https://www.xiaohongshu.com/explore")

    def fetch_html(self, url: str) -> str:
        resp = self._session.get(url, timeout=TIMEOUT)
        if resp.status_code == 461:
            raise XhsApiError("ANTI_BOT", "Request blocked by anti-bot protection (HTTP 461)")
        resp.raise_for_status()
        return resp.text

    def api_get(self, path: str, params: dict | None = None) -> dict:
        url = f"{XHS_API}{path}"
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Origin": "https://www.xiaohongshu.com",
        }
        resp = self._session.get(url, params=params, headers=headers, timeout=TIMEOUT)
        if resp.status_code == 461:
            raise XhsApiError("ANTI_BOT", "Request blocked by anti-bot protection (HTTP 461)")
        resp.raise_for_status()
        return resp.json()

    def api_post(self, path: str, json_data: dict | None = None) -> dict:
        self.require_cookie()
        url = f"{XHS_API}{path}"
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json;charset=UTF-8",
            "Origin": "https://www.xiaohongshu.com",
        }
        resp = self._session.post(url, json=json_data, headers=headers, timeout=TIMEOUT)
        if resp.status_code == 461:
            raise XhsApiError("ANTI_BOT", "Request blocked by anti-bot protection (HTTP 461)")
        resp.raise_for_status()
        return resp.json()


def parse_initial_state(html: str) -> dict:
    """Extract __INITIAL_STATE__ JSON from Xiaohongshu SSR HTML."""
    match = re.search(r"window\.__INITIAL_STATE__\s*=\s*({.+?})\s*</script>", html, re.DOTALL)
    if not match:
        if re.search(r"登录后查看|请登录", html):
            raise XhsApiError("LOGIN_REQUIRED", "Page requires login to view")
        if re.search(r"页面不见了|笔记不存在|无法浏览", html):
            raise XhsApiError("NOT_FOUND", "Note or page not found")
        if re.search(r"安全限制|访问链接异常", html):
            raise XhsApiError("SECURITY_BLOCK", "Access blocked by security check")
        raise XhsApiError("PARSE_ERROR", "Could not find __INITIAL_STATE__ in page HTML")
    raw = match.group(1)
    raw = raw.replace("undefined", "null")
    return json.loads(raw)


def parse_note_id(raw: str) -> str:
    """Extract a note ID from a URL or bare ID.

    Accepts:
      - https://www.xiaohongshu.com/explore/{id}?...
      - https://www.xiaohongshu.com/discovery/item/{id}
      - https://www.xiaohongshu.com/note/{id}
      - https://www.xiaohongshu.com/search_result/{id}
      - https://www.xiaohongshu.com/user/profile/{uid}/{id}
      - Bare 24-char hex ID
    """
    match = re.search(r"(?:explore|note|search_result|discovery/item)/([a-f0-9]{24})", raw)
    if match:
        return match.group(1)
    match = re.search(r"/user/profile/[^/?#]+/([a-f0-9]{24})", raw)
    if match:
        return match.group(1)
    stripped = raw.strip()
    if re.fullmatch(r"[a-f0-9]{24}", stripped):
        return stripped
    raise XhsApiError("INVALID_ID", f"Cannot parse note ID from: {raw}")


def parse_user_id(raw: str) -> str:
    """Extract a user ID from a URL or bare ID."""
    match = re.search(r"/user/profile/([a-zA-Z0-9]+)", raw)
    if match:
        return match.group(1)
    stripped = raw.strip()
    if re.fullmatch(r"[a-zA-Z0-9]+", stripped):
        return stripped
    raise XhsApiError("INVALID_ID", f"Cannot parse user ID from: {raw}")


def parse_note(data: dict) -> dict:
    """Normalize a note from __INITIAL_STATE__ to output format."""
    interact = data.get("interactInfo") or {}
    user = data.get("user") or {}
    images = data.get("imageList") or []
    tags = data.get("tagList") or []
    return {
        "note_id": data.get("noteId", ""),
        "title": data.get("title", ""),
        "desc": data.get("desc", ""),
        "type": data.get("type", ""),
        "author": user.get("nickname", ""),
        "author_id": user.get("userId", ""),
        "avatar": user.get("avatar", ""),
        "likes": _normalize_count(interact.get("likedCount", "0")),
        "collects": _normalize_count(interact.get("collectedCount", "0")),
        "comments": _normalize_count(interact.get("commentCount", "0")),
        "shares": _normalize_count(interact.get("shareCount", "0")),
        "images": [img.get("urlDefault", "") for img in images],
        "tags": [tag.get("name", "") for tag in tags],
        "url": f"{XHS_WEB}/explore/{data.get('noteId', '')}",
    }


def parse_note_card(item: dict) -> dict:
    """Parse a note from feed/search item format (note_card)."""
    card = item.get("note_card") or item.get("noteCard") or {}
    user = card.get("user") or {}
    interact = card.get("interact_info") or card.get("interactInfo") or {}
    note_id = item.get("id") or item.get("note_id") or item.get("noteId") or ""
    return {
        "note_id": note_id,
        "title": card.get("display_title") or card.get("displayTitle") or "",
        "type": card.get("type", ""),
        "author": user.get("nickname") or user.get("nick_name") or "",
        "likes": _normalize_count(interact.get("liked_count") or interact.get("likedCount") or "0"),
        "url": f"{XHS_WEB}/explore/{note_id}",
    }


def _normalize_count(val) -> int:
    if isinstance(val, int):
        return val
    if isinstance(val, str):
        cleaned = val.strip()
        if not cleaned or cleaned in ("赞", "收藏", "评论", "转发"):
            return 0
        cleaned = cleaned.replace("万", "")
        if "." in cleaned and "万" in val:
            return int(float(cleaned) * 10000)
        try:
            return int(cleaned)
        except ValueError:
            return 0
    return 0


def note_id_to_timestamp(note_id: str) -> int | None:
    """Extract Unix timestamp from note ID (MongoDB ObjectID format)."""
    if len(note_id) >= 8:
        try:
            return int(note_id[:8], 16)
        except ValueError:
            return None
    return None
