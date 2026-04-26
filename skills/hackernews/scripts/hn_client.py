"""Shared Hacker News client -- Firebase API helpers and item/user parsers."""

import os
import re

import requests

HN_API_BASE = "https://hacker-news.firebaseio.com/v0"
HN_WEB_BASE = "https://news.ycombinator.com"
ALGOLIA_BASE = "https://hn.algolia.com/api/v1"
USER_AGENT = "sigcli-skill/1.0 (headless client)"
TIMEOUT = 15


class HnApiError(Exception):
    def __init__(self, code: str, message: str = ""):
        self.code = code
        self.message = message or code
        super().__init__(self.message)


class HnClient:
    """HTTP client for Hacker News write operations (cookie auth)."""

    def __init__(self, cookie: str = ""):
        self.cookie = cookie
        self._session = requests.Session()
        self._session.headers["User-Agent"] = USER_AGENT
        if cookie:
            self._session.headers["Cookie"] = cookie

    @classmethod
    def create(cls) -> "HnClient":
        cookie = os.environ.get("SIG_HACKERNEWS_COOKIE", "")
        return cls(cookie)

    def require_cookie(self):
        if not self.cookie:
            raise HnApiError("AUTH_REQUIRED", "This operation requires an HN session cookie. Run: sig login https://news.ycombinator.com/login")

    def _get_fnid(self, url: str) -> str:
        """Fetch a page and extract the fnid (CSRF token) from a hidden form field."""
        resp = self._session.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        match = re.search(r'name="fnid"\s+value="([^"]+)"', resp.text)
        if match:
            return match.group(1)
        match = re.search(r'name="hmac"\s+value="([^"]+)"', resp.text)
        if match:
            return match.group(1)
        raise HnApiError("NO_CSRF", "Could not find fnid/hmac token on page")

    def _get_hmac(self, item_id: int, action: str = "vote") -> str:
        """Get the auth token for voting by fetching the item page."""
        resp = self._session.get(f"{HN_WEB_BASE}/item?id={item_id}", timeout=TIMEOUT)
        resp.raise_for_status()
        pattern = rf'id="{action}_{item_id}"[^>]*href="([^"]*)"'
        match = re.search(pattern, resp.text)
        if not match:
            raise HnApiError("NO_VOTE_LINK", f"Could not find {action} link for item {item_id}")
        href = match.group(1)
        auth_match = re.search(r"auth=([^&]+)", href)
        if not auth_match:
            raise HnApiError("NO_AUTH_TOKEN", f"Could not extract auth token from {action} link")
        return auth_match.group(1)

    def upvote(self, item_id: int) -> dict:
        self.require_cookie()
        auth = self._get_hmac(item_id, "up")
        resp = self._session.get(f"{HN_WEB_BASE}/vote?id={item_id}&how=up&auth={auth}", timeout=TIMEOUT)
        resp.raise_for_status()
        return {"success": True, "id": item_id, "action": "upvoted"}

    def comment(self, parent_id: int, text: str) -> dict:
        self.require_cookie()
        resp = self._session.get(f"{HN_WEB_BASE}/reply?id={parent_id}", timeout=TIMEOUT)
        resp.raise_for_status()
        hmac_match = re.search(r'name="hmac"\s+value="([^"]+)"', resp.text)
        if not hmac_match:
            raise HnApiError("NO_CSRF", "Could not find hmac token on reply page")
        data = {"parent": parent_id, "hmac": hmac_match.group(1), "text": text}
        resp = self._session.post(f"{HN_WEB_BASE}/comment", data=data, timeout=TIMEOUT)
        resp.raise_for_status()
        if "Bad login" in resp.text or "Unknown" in resp.text:
            raise HnApiError("COMMENT_FAILED", "Comment rejected — check login status")
        return {"success": True, "parent": parent_id, "action": "commented"}

    def submit(self, title: str, url: str = "", text: str = "") -> dict:
        self.require_cookie()
        fnid = self._get_fnid(f"{HN_WEB_BASE}/submit")
        data = {"fnid": fnid, "title": title}
        if url:
            data["url"] = url
        if text:
            data["text"] = text
        resp = self._session.post(f"{HN_WEB_BASE}/r", data=data, timeout=TIMEOUT, allow_redirects=False)
        if resp.status_code in (301, 302):
            location = resp.headers.get("Location", "")
            if "newest" in location or "item" in location:
                return {"success": True, "title": title, "action": "submitted", "redirect": location}
        if resp.status_code == 200 and ("Bad login" in resp.text or "Unknown" in resp.text):
            raise HnApiError("SUBMIT_FAILED", "Submission rejected — check login status or rate limit")
        return {"success": True, "title": title, "action": "submitted"}


def fetch_item(item_id):
    """Fetch a single item by ID from the Firebase API."""
    resp = requests.get(f"{HN_API_BASE}/item/{item_id}.json", timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def fetch_items(ids, limit=30):
    """Fetch item IDs list, then fetch each item in detail up to *limit*."""
    items = []
    for item_id in ids[:limit]:
        data = fetch_item(item_id)
        if data:
            items.append(parse_item(data))
    return items


def parse_item(item):
    """Normalize a raw Firebase item to a consistent dict."""
    if not item:
        return None
    return {
        "id": item.get("id"),
        "type": item.get("type"),
        "by": item.get("by", ""),
        "time": item.get("time"),
        "title": item.get("title", ""),
        "url": item.get("url", ""),
        "text": item.get("text", ""),
        "score": item.get("score", 0),
        "descendants": item.get("descendants", 0),
        "kids": item.get("kids", []),
        "parent": item.get("parent"),
        "deleted": item.get("deleted", False),
        "dead": item.get("dead", False),
    }


def parse_user(user):
    """Normalize a raw Firebase user to a consistent dict."""
    if not user:
        return None
    return {
        "id": user.get("id", ""),
        "created": user.get("created"),
        "karma": user.get("karma", 0),
        "about": user.get("about", ""),
        "submitted": user.get("submitted", []),
    }
