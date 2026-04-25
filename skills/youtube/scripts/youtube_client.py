#!/usr/bin/env python3
"""Shared YouTube client for YouTube skill scripts.

Handles HTTP transport for YouTube's InnerTube API,
SAPISIDHASH authentication for write operations,
and response normalization.
"""

from __future__ import annotations

import hashlib
import os
import re
import time
from urllib.parse import parse_qs, urlparse

import requests

YOUTUBE_API_BASE = "https://www.youtube.com/youtubei/v1"
YOUTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
YOUTUBE_ORIGIN = "https://www.youtube.com"
USER_AGENT = "sigcli-skill/1.0 (headless client)"
TIMEOUT = 15

INNERTUBE_CONTEXT = {
    "client": {
        "clientName": "WEB",
        "clientVersion": "2.20260424.01.00",
    }
}


class YouTubeApiError(Exception):
    def __init__(self, code: str, message: str = ""):
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def error_response(code: str, message: str) -> dict:
    return {"error": code, "message": message}


class YouTubeClient:
    """HTTP client for YouTube's InnerTube API with optional cookie auth."""

    def __init__(self, cookie: str = ""):
        self.cookie = cookie
        self._session = requests.Session()
        self._session.headers["User-Agent"] = USER_AGENT
        self._session.headers["Content-Type"] = "application/json"
        if cookie:
            self._session.headers["Cookie"] = cookie
        self._sapisid = self._extract_sapisid(cookie) if cookie else ""

    @classmethod
    def create(cls) -> "YouTubeClient":
        cookie = os.environ.get("SIG_YOUTUBE_COOKIE", "")
        return cls(cookie)

    @staticmethod
    def _extract_sapisid(cookie: str) -> str:
        for name in ("__Secure-3PAPISID", "SAPISID"):
            match = re.search(rf"{name}=([^;]+)", cookie)
            if match:
                return match.group(1)
        return ""

    @staticmethod
    def _compute_sapisidhash(sapisid: str) -> str:
        ts = str(int(time.time()))
        msg = f"{ts} {sapisid} {YOUTUBE_ORIGIN}"
        sha1 = hashlib.sha1(msg.encode()).hexdigest()
        return f"SAPISIDHASH {ts}_{sha1}"

    def post(self, endpoint: str, body=None) -> dict:
        """POST to an InnerTube endpoint (read operations)."""
        url = f"{YOUTUBE_API_BASE}/{endpoint}?key={YOUTUBE_API_KEY}&prettyPrint=false"
        payload = {"context": INNERTUBE_CONTEXT}
        if body:
            payload.update(body)
        resp = self._session.post(url, json=payload, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    def auth_post(self, endpoint: str, body=None) -> dict:
        """POST to an InnerTube endpoint with SAPISIDHASH auth (write operations)."""
        self.require_cookie()
        auth_hash = self._compute_sapisidhash(self._sapisid)
        url = f"{YOUTUBE_API_BASE}/{endpoint}?key={YOUTUBE_API_KEY}&prettyPrint=false"
        payload = {"context": INNERTUBE_CONTEXT}
        if body:
            payload.update(body)
        headers = {
            "Authorization": auth_hash,
            "X-Origin": YOUTUBE_ORIGIN,
        }
        resp = self._session.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        if resp.status_code in (401, 403):
            data = resp.json() if resp.text else {}
            err_status = data.get("error", {}).get("status", "")
            if err_status == "UNAUTHENTICATED" or resp.status_code in (401, 403):
                raise YouTubeApiError("AUTH_EXPIRED", "YouTube session expired. Run: sig login https://www.youtube.com/")
        resp.raise_for_status()
        return resp.json()

    def require_cookie(self):
        if not self.cookie or not self._sapisid:
            raise YouTubeApiError(
                "AUTH_REQUIRED",
                "This operation requires a YouTube session cookie with SAPISID. Run: sig login https://www.youtube.com/",
            )


def parse_video_id(raw: str) -> str:
    """Extract a video ID from a URL or bare ID string."""
    if not raw.startswith("http"):
        return raw.strip()
    try:
        parsed = urlparse(raw)
        qs = parse_qs(parsed.query)
        if "v" in qs:
            return qs["v"][0]
        if parsed.hostname == "youtu.be":
            return parsed.path.lstrip("/").split("/")[0]
        match = re.match(r"^/(shorts|embed|live|v)/([^/?]+)", parsed.path)
        if match:
            return match.group(2)
    except Exception:
        pass
    return raw.strip()


def parse_playlist_id(raw: str) -> str:
    """Extract a playlist ID from a URL or bare ID string."""
    if not raw.startswith("http"):
        return raw.strip()
    try:
        parsed = urlparse(raw)
        qs = parse_qs(parsed.query)
        if "list" in qs:
            return qs["list"][0]
    except Exception:
        pass
    return raw.strip()


def parse_channel_id(raw: str) -> str:
    """Normalize channel input — accept @handle, UCxxxx, or URL."""
    if raw.startswith("http"):
        try:
            parsed = urlparse(raw)
            path = parsed.path.rstrip("/")
            if path.startswith("/@"):
                return path[1:]
            if "/channel/" in path:
                return path.split("/channel/")[-1].split("/")[0]
        except Exception:
            pass
    return raw.strip()
