#!/usr/bin/env python3
"""Shared LinkedIn client for LinkedIn skill scripts.

Handles HTTP transport with JSESSIONID CSRF auth,
Voyager API requests, and response normalization.
"""

from __future__ import annotations

import os
import re
import time

import requests

LINKEDIN_BASE = "https://www.linkedin.com"
VOYAGER_BASE = "https://www.linkedin.com/voyager/api"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
TIMEOUT = 15


class LinkedInApiError(Exception):
    def __init__(self, code: str, message: str = ""):
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def error_response(code: str, message: str) -> dict:
    return {"error": code, "message": message}


class LinkedInClient:
    """HTTP client for LinkedIn's Voyager API with cookie auth."""

    def __init__(self, cookie: str = ""):
        self.cookie = cookie
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/vnd.linkedin.normalized+json+2.1",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.linkedin.com/",
        })
        if cookie:
            self._load_cookies(cookie)
        self._csrf = self._extract_csrf(cookie) if cookie else ""
        if self._csrf:
            self._session.headers["csrf-token"] = self._csrf
            self._session.headers["x-restli-protocol-version"] = "2.0.0"
            self._session.headers["x-li-lang"] = "en_US"

    def _load_cookies(self, cookie_str: str):
        """Parse cookie string into session cookie jar for proper Set-Cookie handling."""
        for part in cookie_str.split("; "):
            if "=" in part:
                name, val = part.split("=", 1)
                self._session.cookies.set(name.strip(), val.strip().strip('"'), domain=".www.linkedin.com")

    @classmethod
    def create(cls) -> "LinkedInClient":
        cookie = os.environ.get("SIG_LINKEDIN_COOKIE", "")
        return cls(cookie)

    @staticmethod
    def _extract_csrf(cookie: str) -> str:
        match = re.search(r'JSESSIONID="?([^";]+)"?', cookie)
        return match.group(1) if match else ""

    def require_cookie(self):
        if not self.cookie or not self._csrf:
            raise LinkedInApiError(
                "AUTH_REQUIRED",
                "This operation requires a LinkedIn session cookie with JSESSIONID. Run: sig login https://www.linkedin.com/login",
            )

    def voyager_get(self, path: str, params: dict | None = None) -> dict:
        self.require_cookie()
        url = f"{VOYAGER_BASE}{path}"
        resp = self._session.get(url, params=params, timeout=TIMEOUT)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.get(url, params=params, timeout=TIMEOUT)
        if resp.status_code == 401:
            raise LinkedInApiError("AUTH_EXPIRED", "LinkedIn session expired. Run: sig login https://www.linkedin.com/login")
        resp.raise_for_status()
        return resp.json()

    def voyager_post(self, path: str, json_data: dict | None = None) -> dict:
        self.require_cookie()
        url = f"{VOYAGER_BASE}{path}"
        resp = self._session.post(url, json=json_data, timeout=TIMEOUT)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.post(url, json=json_data, timeout=TIMEOUT)
        if resp.status_code == 401:
            raise LinkedInApiError("AUTH_EXPIRED", "LinkedIn session expired. Run: sig login https://www.linkedin.com/login")
        resp.raise_for_status()
        if not resp.text:
            return {}
        return resp.json()

    def web_get(self, path: str, params: dict | None = None) -> str:
        """GET a LinkedIn web page and return HTML."""
        self.require_cookie()
        url = f"{LINKEDIN_BASE}{path}"
        headers = {"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}
        resp = self._session.get(url, params=params, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.text


def resolve_profile_id(raw: str) -> str:
    match = re.search(r"linkedin\.com/in/([^/?#]+)", raw)
    if match:
        return match.group(1).rstrip("/")
    return raw.strip().lstrip("@")


def resolve_job_id(raw: str) -> str:
    match = re.search(r"linkedin\.com/jobs/view/(\d+)", raw)
    if match:
        return match.group(1)
    match = re.search(r"(\d{8,})", raw)
    if match:
        return match.group(1)
    return raw.strip()


def parse_profile(data: dict) -> dict:
    elements = data.get("elements", [])
    if not elements:
        included = data.get("included", [])
        for item in included:
            if item.get("$type", "").endswith("Profile") or item.get("firstName"):
                elements = [item]
                break
    if not elements:
        return {}
    p = elements[0]
    mp = p.get("miniProfile") or p
    first = (p.get("multiLocaleFirstName") or {}).get("en_US") or mp.get("firstName", "")
    last = (p.get("multiLocaleLastName") or {}).get("en_US") or mp.get("lastName", "")
    headline = (p.get("multiLocaleHeadline") or {}).get("en_US") or mp.get("headline") or p.get("headline", "")
    location = (p.get("geoLocation") or {}).get("geo", {}).get("defaultLocalizedName") or p.get("geoLocationName", "")
    industry = ((p.get("industryV2") or {}).get("name") or {}).get("locale", {}).get("en_US", "")
    public_id = mp.get("publicIdentifier") or p.get("publicIdentifier", "")
    return {
        "firstName": first,
        "lastName": last,
        "headline": headline,
        "location": location,
        "industry": industry,
        "publicIdentifier": public_id,
        "profileUrl": f"https://www.linkedin.com/in/{public_id}" if public_id else "",
    }


def parse_job_card(element: dict) -> dict | None:
    card = (element.get("jobCardUnion") or {}).get("jobPostingCard")
    if not card:
        return None
    job_id = ""
    for urn_field in [card.get("jobPostingUrn"), (card.get("jobPosting") or {}).get("entityUrn"), card.get("entityUrn")]:
        if urn_field:
            m = re.search(r"(\d+)", str(urn_field))
            if m:
                job_id = m.group(1)
                break
    listed_item = next((i for i in (card.get("footerItems") or []) if i.get("type") == "LISTED_DATE" and i.get("timeAt")), None)
    listed = ""
    if listed_item:
        ts = listed_item["timeAt"] / 1000
        listed = time.strftime("%Y-%m-%d", time.gmtime(ts))
    return {
        "jobId": job_id,
        "title": card.get("jobPostingTitle") or (card.get("title") or {}).get("text", ""),
        "company": (card.get("primaryDescription") or {}).get("text", ""),
        "location": (card.get("secondaryDescription") or {}).get("text", ""),
        "salary": (card.get("tertiaryDescription") or {}).get("text", ""),
        "listed": listed,
        "url": f"https://www.linkedin.com/jobs/view/{job_id}" if job_id else "",
    }


def parse_feed_post(update: dict, included: list | None = None) -> dict:
    actor = (update.get("actor") or {})
    author = actor.get("name", {}).get("text", "") if isinstance(actor.get("name"), dict) else str(actor.get("name", ""))
    actor_url = (actor.get("navigationContext") or {}).get("actionTarget", "")
    commentary = (update.get("commentary") or {}).get("text", {}).get("text", "")
    social = update.get("socialDetail") or {}
    reactions = social.get("totalSocialActivityCounts", {}).get("numLikes", 0)
    comments = social.get("totalSocialActivityCounts", {}).get("numComments", 0)
    urn = update.get("updateUrn") or update.get("urn", "")
    return {
        "author": author,
        "authorUrl": actor_url,
        "text": commentary,
        "reactions": reactions,
        "comments": comments,
        "urn": urn,
        "url": f"https://www.linkedin.com/feed/update/{urn}" if urn else "",
    }
