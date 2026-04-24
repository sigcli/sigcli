"""Shared Hacker News client -- Firebase API helpers and item/user parsers."""

import requests

HN_API_BASE = "https://hacker-news.firebaseio.com/v0"
ALGOLIA_BASE = "https://hn.algolia.com/api/v1"

TIMEOUT = 15


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
