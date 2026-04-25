#!/usr/bin/env python3
"""Shared X (Twitter) GraphQL client for X skill scripts.

Handles HTTP transport with bearer auth, CSRF token extraction,
rate-limit retries, and response normalization for X's GraphQL API.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.parse

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GRAPHQL_BASE = "https://x.com/i/api/graphql"
BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
USER_AGENT = "sigcli-skill/1.0"
TIMEOUT = 20

# ---------------------------------------------------------------------------
# Query IDs (fallback defaults — may need periodic updates)
# ---------------------------------------------------------------------------

QUERY_IDS = {
    "UserByScreenName": "qRednkZG-rn1P6b48NINmQ",
    "UserTweets": "Y59DTUMfcKmUAATiT2SlTw",
    "TweetDetail": "nBS-WpgA6ZG0CyNHD517JQ",
    "SearchTimeline": "MJnbGFOB_MF-5ywMj2FdTg",
    "Followers": "rRXFSG5vR6drKr5M37YOTw",
    "Following": "iSicc7LrzWGBgDPL0tM_TQ",
    "CreateTweet": "bDE2rBtZb3uyrczSZ_pI9g",
    "FavoriteTweet": "lI07N6OaolGPl9u_Z1FxcA",
    "UnfavoriteTweet": "ZYKSe-w7KEslx3JhSIk5LA",
    "CreateRetweet": "ojPdsZsimiJrUGLR1sjUtA",
    "DeleteRetweet": "iQtK4dl5hBmXewYZuEOKVw",
    "CreateBookmark": "aaDnft_gKxX4OWoR900UMQ",
    "DeleteBookmark": "Wlmlj2-xISz1HUqEPgNxVQ",
}

# ---------------------------------------------------------------------------
# Feature flags (required by most GraphQL endpoints)
# ---------------------------------------------------------------------------

FEATURES_USER = {
    "hidden_profile_subscriptions_enabled": True,
    "rweb_tipjar_consumption_enabled": True,
    "responsive_web_graphql_exclude_directive_enabled": True,
    "verified_phone_label_enabled": False,
    "subscriptions_verification_info_is_identity_verified_enabled": True,
    "subscriptions_verification_info_verified_since_enabled": True,
    "highlights_tweets_tab_ui_enabled": True,
    "responsive_web_twitter_article_notes_tab_enabled": True,
    "subscriptions_feature_can_gift_premium": True,
    "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "responsive_web_graphql_timeline_navigation_enabled": True,
}

FEATURES_TIMELINE = {
    "rweb_tipjar_consumption_enabled": True,
    "responsive_web_graphql_exclude_directive_enabled": True,
    "verified_phone_label_enabled": False,
    "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_timeline_navigation_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "communities_web_enable_tweet_community_results_fetch": True,
    "c9s_tweet_anatomy_moderator_badge_enabled": True,
    "articles_preview_enabled": True,
    "responsive_web_edit_tweet_api_enabled": True,
    "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
    "view_counts_everywhere_api_enabled": True,
    "longform_notetweets_consumption_enabled": True,
    "responsive_web_twitter_article_tweet_consumption_enabled": True,
    "tweet_awards_web_tipping_enabled": False,
    "freedom_of_speech_not_reach_fetch_enabled": True,
    "standardized_nudges_misinfo": True,
    "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
    "longform_notetweets_rich_text_read_enabled": True,
    "longform_notetweets_inline_media_enabled": True,
    "responsive_web_enhance_cards_enabled": False,
}

FEATURES_TWEET_DETAIL = {
    "responsive_web_graphql_exclude_directive_enabled": True,
    "verified_phone_label_enabled": False,
    "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_timeline_navigation_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "longform_notetweets_consumption_enabled": True,
    "longform_notetweets_rich_text_read_enabled": True,
    "longform_notetweets_inline_media_enabled": True,
    "freedom_of_speech_not_reach_fetch_enabled": True,
}

FIELD_TOGGLES_TWEET_DETAIL = {
    "withArticleRichContentState": True,
    "withArticlePlainText": False,
}

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class XApiError(Exception):
    """Raised when X returns an unexpected response."""

    def __init__(self, code: str, message: str = ""):
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def error_response(code: str, message: str) -> dict:
    return {"error": code, "message": message}


# ---------------------------------------------------------------------------
# X GraphQL API client
# ---------------------------------------------------------------------------


class XClient:
    """HTTP client for X's GraphQL API with cookie auth.

    Read operations need only the bearer token (public).
    Write operations require a session cookie with ct0 CSRF token.
    """

    def __init__(self, cookie: str = ""):
        self.cookie = cookie
        self._session = requests.Session()
        self._ct0 = self._extract_ct0(cookie) if cookie else ""
        self._session.headers.update({
            "User-Agent": USER_AGENT,
            "Authorization": f"Bearer {urllib.parse.unquote(BEARER_TOKEN)}",
            "X-Twitter-Active-User": "yes",
            "X-Twitter-Client-Language": "en",
        })
        if cookie:
            self._session.headers["Cookie"] = cookie
        if self._ct0:
            self._session.headers["X-Csrf-Token"] = self._ct0
            self._session.headers["X-Twitter-Auth-Type"] = "OAuth2Session"

    @classmethod
    def create(cls) -> "XClient":
        cookie = os.environ.get("SIG_X_COOKIE", "")
        return cls(cookie)

    @staticmethod
    def _extract_ct0(cookie: str) -> str:
        match = re.search(r"ct0=([^;]+)", cookie)
        return match.group(1) if match else ""

    def require_cookie(self):
        if not self.cookie or not self._ct0:
            raise XApiError("AUTH_REQUIRED", "This operation requires an X session cookie with ct0. Run: sig login https://x.com/")

    # -- GraphQL helpers ---------------------------------------------------

    def graphql_get(self, operation: str, variables: dict, features: dict | None = None, field_toggles: dict | None = None) -> dict:
        query_id = QUERY_IDS.get(operation, "")
        params: dict[str, str] = {"variables": json.dumps(variables)}
        if features:
            params["features"] = json.dumps(features)
        if field_toggles:
            params["fieldToggles"] = json.dumps(field_toggles)
        url = f"{GRAPHQL_BASE}/{query_id}/{operation}"
        return self._get(url, params=params)

    def graphql_post(self, operation: str, variables: dict, features: dict | None = None) -> dict:
        self.require_cookie()
        query_id = QUERY_IDS.get(operation, "")
        url = f"{GRAPHQL_BASE}/{query_id}/{operation}"
        payload: dict = {"variables": variables, "queryId": query_id}
        if features:
            payload["features"] = features
        return self._post_json(url, payload)

    # -- HTTP transport ----------------------------------------------------

    def _get(self, url: str, params: dict | None = None) -> dict:
        resp = self._session.get(url, params=params, timeout=TIMEOUT)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    def _post_json(self, url: str, payload: dict) -> dict:
        resp = self._session.post(url, json=payload, timeout=TIMEOUT)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.post(url, json=payload, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    # -- REST helpers (for follow/unfollow) --------------------------------

    def rest_post(self, path: str, data: dict | None = None) -> dict:
        self.require_cookie()
        url = f"https://x.com{path}"
        resp = self._session.post(url, data=data, timeout=TIMEOUT)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.post(url, data=data, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# URL / ID helpers
# ---------------------------------------------------------------------------


def resolve_tweet_id(raw: str) -> str:
    """Extract a tweet ID from a URL or bare ID."""
    match = re.search(r"/status/(\d+)", raw)
    if match:
        return match.group(1)
    return raw.strip()


def resolve_username(raw: str) -> str:
    """Normalize a username (strip @ and URL prefix)."""
    raw = raw.strip()
    match = re.search(r"x\.com/([A-Za-z0-9_]+)", raw)
    if match:
        return match.group(1)
    match = re.search(r"twitter\.com/([A-Za-z0-9_]+)", raw)
    if match:
        return match.group(1)
    return raw.lstrip("@")


# ---------------------------------------------------------------------------
# Response parsers
# ---------------------------------------------------------------------------


def extract_media(legacy: dict) -> dict:
    media = (legacy.get("extended_entities") or {}).get("media") or (legacy.get("entities") or {}).get("media")
    if not media:
        return {"has_media": False, "media_urls": []}
    urls = []
    for m in media:
        if not m:
            continue
        if m.get("type") in ("video", "animated_gif"):
            variants = (m.get("video_info") or {}).get("variants") or []
            mp4 = next((v for v in variants if v.get("content_type") == "video/mp4"), None)
            url = (mp4 or {}).get("url") or m.get("media_url_https")
            if url:
                urls.append(url)
        else:
            if m.get("media_url_https"):
                urls.append(m["media_url_https"])
    return {"has_media": len(urls) > 0, "media_urls": urls}


def parse_tweet(result: dict, seen: set | None = None) -> dict | None:
    if not result:
        return None
    tw = result.get("tweet") or result
    legacy = tw.get("legacy") or {}
    rest_id = tw.get("rest_id")
    if not rest_id:
        return None
    if seen is not None:
        if rest_id in seen:
            return None
        seen.add(rest_id)
    user = (tw.get("core") or {}).get("user_results", {}).get("result") or {}
    user_legacy = user.get("legacy") or {}
    user_core = user.get("core") or {}
    screen_name = user_legacy.get("screen_name") or user_core.get("screen_name") or "unknown"
    display_name = user_legacy.get("name") or user_core.get("name") or ""
    note_text = ((tw.get("note_tweet") or {}).get("note_tweet_results") or {}).get("result", {}).get("text")
    is_retweet = bool(legacy.get("retweeted_status_result") or (legacy.get("full_text") or "").startswith("RT @"))
    return {
        "id": rest_id,
        "author": screen_name,
        "name": display_name,
        "text": note_text or legacy.get("full_text") or "",
        "likes": legacy.get("favorite_count") or 0,
        "retweets": legacy.get("retweet_count") or 0,
        "replies": legacy.get("reply_count") or 0,
        "views": int((tw.get("views") or {}).get("count") or 0),
        "is_retweet": is_retweet,
        "created_at": legacy.get("created_at") or "",
        "url": f"https://x.com/{screen_name}/status/{rest_id}",
        "in_reply_to": legacy.get("in_reply_to_status_id_str"),
        **extract_media(legacy),
    }


def parse_user(result: dict) -> dict | None:
    if not result:
        return None
    legacy = result.get("legacy") or {}
    expanded_url = ""
    url_entities = (legacy.get("entities") or {}).get("url", {}).get("urls") or []
    if url_entities:
        expanded_url = url_entities[0].get("expanded_url") or ""
    return {
        "screen_name": legacy.get("screen_name") or "",
        "name": legacy.get("name") or "",
        "bio": legacy.get("description") or "",
        "location": legacy.get("location") or "",
        "url": expanded_url,
        "followers": legacy.get("followers_count") or 0,
        "following": legacy.get("friends_count") or 0,
        "tweets": legacy.get("statuses_count") or 0,
        "likes": legacy.get("favourites_count") or 0,
        "verified": result.get("is_blue_verified") or legacy.get("verified") or False,
        "created_at": legacy.get("created_at") or "",
        "id": result.get("rest_id") or "",
    }


def parse_timeline_tweets(instructions: list, seen: set | None = None) -> tuple[list[dict], str | None]:
    """Parse tweets and cursor from timeline instructions."""
    if seen is None:
        seen = set()
    tweets: list[dict] = []
    next_cursor: str | None = None

    for inst in instructions:
        if inst.get("type") == "TimelinePinEntry":
            continue
        for entry in inst.get("entries") or []:
            content = entry.get("content") or {}
            entry_type = content.get("entryType") or content.get("__typename") or ""
            if entry_type == "TimelineTimelineCursor":
                if content.get("cursorType") in ("Bottom", "ShowMore"):
                    next_cursor = content.get("value")
                continue
            entry_id = entry.get("entryId") or ""
            if entry_id.startswith("cursor-bottom-") or entry_id.startswith("cursor-showMore-"):
                next_cursor = content.get("value") or (content.get("itemContent") or {}).get("value") or next_cursor
                continue
            tweet_result = (content.get("itemContent") or {}).get("tweet_results", {}).get("result")
            tw = parse_tweet(tweet_result, seen)
            if tw:
                tweets.append(tw)
                continue
            for item in content.get("items") or []:
                nested_result = ((item.get("item") or {}).get("itemContent") or {}).get("tweet_results", {}).get("result")
                ntw = parse_tweet(nested_result, seen)
                if ntw:
                    tweets.append(ntw)

    return tweets, next_cursor
