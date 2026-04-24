#!/usr/bin/env python3
"""Shared Reddit client for Reddit skill scripts.

Handles HTTP transport with User-Agent, rate-limit retries,
and response normalization for Reddit's public JSON API.
"""

from __future__ import annotations

import time

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REDDIT_BASE = "https://www.reddit.com"
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
    """Thin HTTP client for Reddit's public JSON API.

    All requests use a descriptive User-Agent to avoid 429 responses.
    Rate-limited responses (HTTP 429) are retried once after a delay.
    """

    def __init__(self):
        self._session = requests.Session()
        self._session.headers["User-Agent"] = USER_AGENT

    def get(self, url: str, params: dict | None = None) -> dict:
        """GET a Reddit JSON endpoint.

        Appends .json if not already present. Retries once on HTTP 429.

        Returns:
            Parsed JSON response body.

        Raises:
            requests.HTTPError: On non-429 HTTP errors.
        """
        resp = self._session.get(url, params=params, timeout=TIMEOUT)

        # Rate limit: retry once
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.get(url, params=params, timeout=TIMEOUT)

        resp.raise_for_status()
        return resp.json()


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
