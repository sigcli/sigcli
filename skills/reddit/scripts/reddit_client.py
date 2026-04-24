#!/usr/bin/env python3
"""Shared Reddit client for Reddit skill scripts.

Handles HTTP transport with User-Agent, rate-limit retries,
and response normalization for Reddit's public JSON API.
"""

from __future__ import annotations

import os
import re
import time

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REDDIT_BASE = "https://www.reddit.com"
REDDIT_OAUTH = "https://oauth.reddit.com"
USER_AGENT = "sigcli-skill/1.0 (headless client)"
TIMEOUT = 15

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class RedditApiError(Exception):
    """Raised when Reddit returns an unexpected response."""

    def __init__(self, code: str, message: str = ""):
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def error_response(code: str, message: str) -> dict:
    """Build a standard error dict for JSON output."""
    return {"error": code, "message": message}


# ---------------------------------------------------------------------------
# Reddit API client
# ---------------------------------------------------------------------------


class RedditClient:
    """HTTP client for Reddit's JSON API with optional cookie auth.

    All requests use a descriptive User-Agent to avoid 429 responses.
    Rate-limited responses (HTTP 429) are retried once after a delay.
    """

    def __init__(self, cookie: str = ""):
        self.cookie = cookie
        self._session = requests.Session()
        self._session.headers["User-Agent"] = USER_AGENT
        if cookie:
            self._session.headers["Cookie"] = cookie
        self._bearer_token = self._extract_token(cookie) if cookie else ""

    @classmethod
    def create(cls) -> "RedditClient":
        cookie = os.environ.get("SIG_REDDIT_COOKIE", "")
        return cls(cookie)

    @staticmethod
    def _extract_token(cookie: str) -> str:
        """Extract token_v2 from cookie string for OAuth bearer auth."""
        match = re.search(r"token_v2=([^;]+)", cookie)
        return match.group(1) if match else ""

    def get(self, url: str, params: dict | None = None) -> dict:
        """GET a Reddit JSON endpoint. Retries once on HTTP 429."""
        resp = self._session.get(url, params=params, timeout=TIMEOUT)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.get(url, params=params, timeout=TIMEOUT)

        resp.raise_for_status()
        return resp.json()

    def post(self, url: str, data: dict | None = None) -> dict:
        """POST form-encoded data to a Reddit API endpoint."""
        resp = self._session.post(url, data=data, timeout=TIMEOUT)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.post(url, data=data, timeout=TIMEOUT)

        resp.raise_for_status()
        return resp.json()

    def oauth_get(self, path: str, params: dict | None = None) -> dict:
        """GET from oauth.reddit.com with Bearer auth."""
        self.require_cookie()
        headers = {"Authorization": f"Bearer {self._bearer_token}"}
        resp = self._session.get(f"{REDDIT_OAUTH}{path}", params=params, headers=headers, timeout=TIMEOUT)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.get(f"{REDDIT_OAUTH}{path}", params=params, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    def oauth_post(self, path: str, data: dict | None = None) -> dict:
        """POST to oauth.reddit.com with Bearer auth."""
        self.require_cookie()
        headers = {"Authorization": f"Bearer {self._bearer_token}"}
        resp = self._session.post(f"{REDDIT_OAUTH}{path}", data=data, headers=headers, timeout=TIMEOUT)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.post(f"{REDDIT_OAUTH}{path}", data=data, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    def get_me(self) -> dict:
        """Fetch current user info via OAuth."""
        return self.oauth_get("/api/v1/me")

    def require_cookie(self):
        if not self.cookie or not self._bearer_token:
            raise RedditApiError("AUTH_REQUIRED", "This operation requires a Reddit session cookie with token_v2. Run: sig login https://www.reddit.com/")


# ---------------------------------------------------------------------------
# URL / ID helpers
# ---------------------------------------------------------------------------


def resolve_post_id(raw: str) -> str:
    """Extract a bare post ID from a URL, fullname, or bare ID.

    Accepts:
      - Full URL: https://www.reddit.com/r/python/comments/1abc123/...
      - Short link: https://redd.it/1abc123
      - Fullname: t3_1abc123
      - Bare ID: 1abc123
    """
    match = re.search(r"/comments/([a-z0-9]+)", raw)
    if match:
        return match.group(1)
    match = re.search(r"redd\.it/([a-z0-9]+)", raw)
    if match:
        return match.group(1)
    if raw.startswith("t3_"):
        return raw[3:]
    return raw.strip()


def to_fullname(post_id: str, kind: str = "t3") -> str:
    """Ensure an ID has the Reddit fullname prefix."""
    if post_id.startswith(f"{kind}_"):
        return post_id
    return f"{kind}_{post_id}"


# ---------------------------------------------------------------------------
# Response parsers
# ---------------------------------------------------------------------------


def parse_post(data: dict) -> dict:
    """Normalize a Reddit post (t3) data dict to our output format."""
    return {
        "id": data.get("id", ""),
        "title": data.get("title", ""),
        "author": data.get("author", ""),
        "subreddit": data.get("subreddit", ""),
        "score": data.get("score", 0),
        "upvote_ratio": data.get("upvote_ratio", 0),
        "num_comments": data.get("num_comments", 0),
        "created_utc": data.get("created_utc", 0),
        "url": data.get("url", ""),
        "permalink": data.get("permalink", ""),
        "selftext": data.get("selftext", ""),
        "is_self": data.get("is_self", False),
        "thumbnail": data.get("thumbnail", ""),
        "link_flair_text": data.get("link_flair_text"),
        "over_18": data.get("over_18", False),
    }


def parse_comment(data: dict, depth: int = 0) -> dict:
    """Normalize a Reddit comment (t1) data dict with nested replies."""
    replies = []
    raw_replies = data.get("replies")
    if isinstance(raw_replies, dict):
        children = raw_replies.get("data", {}).get("children", [])
        for child in children:
            if child.get("kind") == "t1":
                replies.append(parse_comment(child["data"], depth + 1))

    return {
        "id": data.get("id", ""),
        "author": data.get("author", ""),
        "body": data.get("body", ""),
        "score": data.get("score", 0),
        "created_utc": data.get("created_utc", 0),
        "permalink": data.get("permalink", ""),
        "depth": depth,
        "replies": replies if replies else None,
    }


def parse_subreddit(data: dict) -> dict:
    """Normalize a Reddit subreddit data dict."""
    return {
        "display_name": data.get("display_name", ""),
        "title": data.get("title", ""),
        "public_description": data.get("public_description", ""),
        "subscribers": data.get("subscribers", 0),
        "active_user_count": data.get("active_user_count", 0),
        "created_utc": data.get("created_utc", 0),
        "over18": data.get("over18", False),
        "url": data.get("url", ""),
    }
