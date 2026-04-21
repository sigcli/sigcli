#!/usr/bin/env python3
"""Shared Slack Web API client for Slack skill scripts.

Handles Signet token extraction, HTTP transport with xoxc/xoxd auth,
rate-limit retries, channel resolution, and time-range parsing.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
import uuid

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SLACK_API_BASE = "https://slack.com/api"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
TIMEOUT = 30

# Time-range suffixes: "1d" = 1 day, "7d" = 7 days, etc.
_TIME_RANGE_RE = re.compile(r"^(\d+)([dhm])$")
_TIME_MULTIPLIERS = {"d": 86400, "h": 3600, "m": 60}


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class SlackApiError(Exception):
    """Raised when Slack returns ok=false."""

    def __init__(self, error_code: str, message: str = ""):
        self.error_code = error_code
        self.message = message or error_code
        super().__init__(self.message)


def error_response(code: str, message: str) -> dict:
    """Build a standard error dict for JSON output."""
    return {"error": code, "message": message}


# ---------------------------------------------------------------------------
# Token extraction from Signet
# ---------------------------------------------------------------------------


def _parse_cookie_value(cookie_string: str, name: str) -> str | None:
    """Extract a named value from a cookie header string."""
    for part in cookie_string.split(";"):
        part = part.strip()
        if "=" not in part:
            continue
        key, _, value = part.partition("=")
        if key.strip() == name:
            return value.strip()
    return None


def get_slack_credentials() -> tuple[str, str]:
    """Retrieve Slack xoxc token and full cookie string.

    Reads from SIG_APP_SLACK_* env vars (set by ``sig run app-slack --``).
    Returns empty strings when not set (proxy mode: sig proxy injects credentials).

    Returns:
        Tuple of (xoxc_token, cookie_string). Either may be empty string.
    """
    cookie_string = os.environ.get("SIG_APP_SLACK_COOKIE", "")
    xoxc = os.environ.get("SIG_APP_SLACK_LOCAL_XOXC_TOKEN", "")

    if cookie_string and xoxc:
        raw_d = _parse_cookie_value(cookie_string, "d")
        if not raw_d:
            raise RuntimeError("Cookie 'd' not found in SIG_APP_SLACK_COOKIE")

    return xoxc, cookie_string


# ---------------------------------------------------------------------------
# Slack API client
# ---------------------------------------------------------------------------


class SlackClient:
    """Thin HTTP client for the Slack Web API using xoxc browser tokens.

    Auth is sent as:
    - ``token`` form parameter (xoxc)
    - ``Cookie`` header (full cookie string from Signet, containing ``d=xoxd-...``)
    """

    def __init__(self, xoxc: str, cookies: str):
        self.xoxc = xoxc
        self.cookies = cookies
        self._session = requests.Session()
        self._session.headers["User-Agent"] = USER_AGENT
        if cookies:
            self._session.headers["Cookie"] = cookies
        # Cached from auth_test
        self._workspace_url: str | None = None
        self._team_id: str | None = None
        self._user_id: str | None = None

    @classmethod
    def create(cls) -> SlackClient:
        """Create a client by extracting credentials from Signet."""
        xoxc, cookies = get_slack_credentials()
        return cls(xoxc, cookies)

    # ---- Core API call ----

    def api_call(self, method: str, params: dict | None = None) -> dict:
        """POST to https://slack.com/api/{method} with form-encoded params.

        The xoxc token is injected as the ``token`` form field.
        Retries once on HTTP 429 (rate limited).

        Returns:
            Parsed JSON response body (the ``ok`` field is already validated).

        Raises:
            SlackApiError: If the Slack API returns ``ok: false``.
            requests.HTTPError: On non-429 HTTP errors.
        """
        form = dict(params or {})
        if self.xoxc:
            form["token"] = self.xoxc
        url = f"{SLACK_API_BASE}/{method}"

        resp = self._session.post(url, data=form, timeout=TIMEOUT)

        # Rate limit: retry once
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.post(url, data=form, timeout=TIMEOUT)

        resp.raise_for_status()
        data = resp.json()

        if not data.get("ok"):
            raise SlackApiError(
                data.get("error", "unknown_error"),
                data.get("error", "Slack API returned ok=false"),
            )
        return data

    def webclient_call(self, method: str, params: dict | None = None) -> dict:
        """POST to {workspace}/api/{method} for webclient/edge APIs.

        Same auth pattern as api_call but uses the workspace-specific URL.
        """
        workspace_url = self.workspace_url
        form = dict(params or {})
        if self.xoxc:
            form["token"] = self.xoxc
        url = f"{workspace_url}api/{method}"

        resp = self._session.post(url, data=form, timeout=TIMEOUT)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.post(url, data=form, timeout=TIMEOUT)

        resp.raise_for_status()
        data = resp.json()

        if not data.get("ok"):
            raise SlackApiError(
                data.get("error", "unknown_error"),
                data.get("error", "Slack webclient API returned ok=false"),
            )
        return data

    # ---- Edge cache API ----

    def edge_api_call(self, path: str, payload: dict | None = None) -> dict:
        """POST JSON to https://edgeapi.slack.com/cache/{team_id}/{path}.

        Used for edge cache APIs (e.g. users/search) that use JSON encoding
        instead of form encoding.
        """
        team_id = self.team_id
        payload = dict(payload or {})
        if self.xoxc:
            payload["token"] = self.xoxc
        url = f"https://edgeapi.slack.com/cache/{team_id}/{path}"

        resp = self._session.post(url, json=payload, timeout=TIMEOUT)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.post(url, json=payload, timeout=TIMEOUT)

        resp.raise_for_status()
        data = resp.json()

        if not data.get("ok"):
            raise SlackApiError(
                data.get("error", "unknown_error"),
                data.get("error", "Edge API returned ok=false"),
            )
        return data

    # ---- Auth test / workspace discovery ----

    def auth_test(self) -> dict:
        """Call auth.test and cache workspace URL, team_id, user_id."""
        data = self.api_call("auth.test")
        self._workspace_url = data.get("url", "")
        if self._workspace_url and not self._workspace_url.endswith("/"):
            self._workspace_url += "/"
        self._team_id = data.get("team_id", "")
        self._user_id = data.get("user_id", "")
        return data

    @property
    def workspace_url(self) -> str:
        """Lazy-load workspace URL from auth.test."""
        if not self._workspace_url:
            self.auth_test()
        return self._workspace_url

    @property
    def team_id(self) -> str:
        if not self._team_id:
            self.auth_test()
        return self._team_id

    @property
    def user_id(self) -> str:
        if not self._user_id:
            self.auth_test()
        return self._user_id


# ---------------------------------------------------------------------------
# Channel resolution
# ---------------------------------------------------------------------------


def _build_search_channels_form(
    query: str = "",
    count: int = 100,
    cursor: str = "*",
    sort: str = "name",
    sort_dir: str = "asc",
) -> dict[str, str]:
    """Build form parameters for the search.modules.channels webclient API."""
    return {
        "module": "channels",
        "query": query,
        "count": str(count),
        "cursor": cursor,
        "client_req_id": str(uuid.uuid4()),
        "browse_session_id": str(uuid.uuid4()),
        "extracts": "0",
        "highlight": "0",
        "extra_message_data": "0",
        "no_user_profile": "1",
        "file_title_only": "false",
        "query_rewrite_disabled": "false",
        "include_files_shares": "1",
        "browse": "standard",
        "search_context": "desktop_channel_browser",
        "max_filter_suggestions": "10",
        "sort": sort,
        "sort_dir": sort_dir,
        "channel_type": "",
        "exclude_my_channels": "0",
        "search_only_my_channels": "false",
        "recommend_source": "channel-browser",
        "_x_reason": "browser-query",
        "_x_mode": "online",
        "_x_sonic": "true",
        "_x_app_name": "client",
    }


def resolve_channel(client: SlackClient, channel_arg: str) -> str:
    """Resolve ``#name``, ``@user``, or a raw channel ID to a Slack channel ID.

    - Strings starting with ``#`` are looked up via conversations.list,
      with fallback to search.modules.channels on enterprise workspaces.
    - Strings starting with ``@`` open a DM via conversations.open,
      with fallback to edge users/search on enterprise workspaces.
    - Everything else (``C...``, ``D...``, ``G...``) is returned as-is.
    """
    if channel_arg.startswith("#"):
        name = channel_arg.lstrip("#")
        try:
            for types in ["public_channel,private_channel", "im,mpim"]:
                cursor = None
                while True:
                    params: dict = {"types": types, "limit": "200", "exclude_archived": "true"}
                    if cursor:
                        params["cursor"] = cursor
                    data = client.api_call("conversations.list", params)
                    for ch in data.get("channels", []):
                        if ch.get("name") == name:
                            return ch["id"]
                    cursor = data.get("response_metadata", {}).get("next_cursor")
                    if not cursor:
                        break
        except SlackApiError as e:
            if e.error_code == "enterprise_is_restricted":
                return _resolve_channel_by_search(client, name)
            raise
        raise SlackApiError("channel_not_found", f"Channel #{name} not found")

    if channel_arg.startswith("@"):
        username = channel_arg.lstrip("@")
        # Prefer edge search (fast, server-side) over users.list (slow pagination)
        try:
            return _resolve_user_dm_by_search(client, username)
        except Exception:
            pass
        # Fall back to standard users.list
        cursor = None
        while True:
            params = {"limit": "200"}
            if cursor:
                params["cursor"] = cursor
            data = client.api_call("users.list", params)
            for user in data.get("members", []):
                if (
                    user.get("name") == username
                    or user.get("profile", {}).get("display_name_normalized", "").lower() == username.lower()
                ):
                    dm = client.api_call("conversations.open", {"users": user["id"]})
                    return dm["channel"]["id"]
            cursor = data.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break
        raise SlackApiError("user_not_found", f"User @{username} not found")

    # Assume raw channel ID
    return channel_arg


def _resolve_channel_by_search(client: SlackClient, name: str) -> str:
    """Resolve channel name via search.modules.channels (enterprise fallback)."""
    params = _build_search_channels_form(query=name, count=50)
    data = client.webclient_call("search.modules.channels", params)
    for item in data.get("items", []):
        if item.get("name") == name:
            return item["id"]
    raise SlackApiError("channel_not_found", f"Channel #{name} not found")


def _resolve_user_dm_by_search(client: SlackClient, username: str) -> str:
    """Resolve @user to DM channel via edge users/search (enterprise fallback)."""
    data = client.edge_api_call("users/search", {"query": username, "count": 20})
    for user in data.get("results", []):
        if (
            user.get("name") == username
            or user.get("profile", {}).get("display_name_normalized", "").lower() == username.lower()
        ):
            dm = client.api_call("conversations.open", {"users": user["id"]})
            return dm["channel"]["id"]
    raise SlackApiError("user_not_found", f"User @{username} not found")


# ---------------------------------------------------------------------------
# Time-range / limit parsing
# ---------------------------------------------------------------------------


def parse_limit(limit_str: str) -> tuple[int | None, float | None]:
    """Parse a ``--limit`` value into (count, oldest_ts).

    Accepts:
        - Time ranges: ``"1d"``, ``"7d"``, ``"30d"``, ``"2h"``, ``"30m"``
        - Numeric counts: ``"50"``, ``"100"``

    Returns:
        ``(count, oldest_ts)`` — exactly one is ``None``.
    """
    m = _TIME_RANGE_RE.match(limit_str)
    if m:
        value = int(m.group(1))
        unit = m.group(2)
        seconds = value * _TIME_MULTIPLIERS[unit]
        oldest = time.time() - seconds
        return None, oldest

    # Numeric count
    try:
        count = int(limit_str)
    except ValueError:
        raise ValueError(f"Invalid --limit value: {limit_str!r}. Use a time range (1d, 7d, 30d) or a number (50).")
    return count, None


# ---------------------------------------------------------------------------
# Message formatting helpers
# ---------------------------------------------------------------------------

# Slack message subtypes that represent channel activity, not user messages
ACTIVITY_SUBTYPES = frozenset(
    {
        "channel_join",
        "channel_leave",
        "channel_topic",
        "channel_purpose",
        "channel_name",
        "channel_archive",
        "channel_unarchive",
        "group_join",
        "group_leave",
        "group_topic",
        "group_purpose",
        "group_name",
        "group_archive",
        "group_unarchive",
    }
)


def format_message(msg: dict, include_activity: bool = False) -> dict | None:
    """Convert a raw Slack message dict to our output format.

    Returns None if the message should be filtered out.
    """
    subtype = msg.get("subtype", "")
    if not include_activity and subtype in ACTIVITY_SUBTYPES:
        return None

    reactions = []
    for r in msg.get("reactions", []):
        reactions.append({"name": r.get("name", ""), "count": r.get("count", 0)})

    return {
        "ts": msg.get("ts", ""),
        "user": msg.get("user", msg.get("bot_id", "")),
        "username": msg.get("username", ""),
        "text": msg.get("text", ""),
        "thread_ts": msg.get("thread_ts"),
        "reply_count": msg.get("reply_count", 0),
        "reactions": reactions or None,
        "subtype": subtype or None,
        "files": len(msg.get("files", [])) or None,
    }
