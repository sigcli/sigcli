"""Shared V2EX client — cookie session, CSRF token extraction, HTML helpers."""

import os
import re
import time

import requests
from bs4 import BeautifulSoup

V2EX_BASE = "https://www.v2ex.com"
V2EX_API_V1 = V2EX_BASE + "/api"
V2EX_API_V2 = V2EX_BASE + "/api/v2"
SOV2EX_API = "https://www.sov2ex.com/api/search"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

TIMEOUT = 15


class V2exError(Exception):
    def __init__(self, code, message=""):
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


class V2exClient:
    def __init__(self, cookie=""):
        self.cookie = cookie
        self._session = requests.Session()
        self._session.headers["User-Agent"] = USER_AGENT
        if cookie:
            self._session.headers["Cookie"] = cookie
        self._once = None

    @classmethod
    def create(cls):
        cookie = os.environ.get("SIG_V2EX_COOKIE", "")
        return cls(cookie)

    def get(self, url, params=None, timeout=TIMEOUT):
        resp = self._session.get(url, params=params, timeout=timeout)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.get(url, params=params, timeout=timeout)
        resp.raise_for_status()
        return resp

    def post(self, url, data=None, timeout=TIMEOUT):
        resp = self._session.post(url, data=data, timeout=timeout, allow_redirects=False)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.post(url, data=data, timeout=timeout, allow_redirects=False)
        return resp

    def api_v1(self, path, params=None):
        resp = self.get(V2EX_API_V1 + path, params=params)
        return resp.json()

    def api_v2(self, path, params=None):
        resp = self.get(V2EX_API_V2 + path, params=params)
        data = resp.json()
        if not data.get("success"):
            raise V2exError("API_ERROR", data.get("message", "Unknown error"))
        return data.get("result")

    def get_once(self, page_url=None):
        url = page_url or V2EX_BASE + "/mission/daily"
        resp = self.get(url)
        html = resp.text
        match = re.search(r'name="once"\s+value="(\d+)"', html)
        if not match:
            match = re.search(r"once=(\d+)", html)
        if not match:
            match = re.search(r"'once':\s*'(\d+)'", html)
        if not match:
            raise V2exError("ONCE_NOT_FOUND", "Failed to extract CSRF once token — session may be expired")
        self._once = match.group(1)
        return self._once, html

    def require_cookie(self):
        if not self.cookie:
            raise V2exError("AUTH_REQUIRED", "This operation requires a V2EX session cookie. Run: sig login https://www.v2ex.com/")


def get_v2ex_cookie():
    return os.environ.get("SIG_V2EX_COOKIE", "")


def parse_topic_item(t):
    return {
        "id": t.get("id"),
        "title": t.get("title", ""),
        "url": t.get("url", ""),
        "content_preview": (t.get("content", "") or "")[:200],
        "replies": t.get("replies", 0),
        "created": t.get("created"),
        "last_modified": t.get("last_modified"),
        "last_touched": t.get("last_touched"),
        "node": _parse_node_brief(t.get("node")) if t.get("node") else None,
        "member": _parse_member_brief(t.get("member")) if t.get("member") else None,
    }


def parse_reply_item(r):
    return {
        "id": r.get("id"),
        "content": r.get("content", ""),
        "content_rendered": r.get("content_rendered", ""),
        "created": r.get("created"),
        "member": _parse_member_brief(r.get("member")) if r.get("member") else None,
    }


def _parse_node_brief(n):
    if not n:
        return None
    return {
        "id": n.get("id"),
        "name": n.get("name", ""),
        "title": n.get("title", ""),
    }


def _parse_member_brief(m):
    if not m:
        return None
    return {
        "id": m.get("id"),
        "username": m.get("username", ""),
        "avatar": m.get("avatar_normal", m.get("avatar_mini", "")),
    }


def parse_topic_page(html):
    soup = BeautifulSoup(html, "html.parser")
    topic = {}

    header = soup.select_one("div.header h1")
    if header:
        topic["title"] = header.get_text(strip=True)

    content_div = soup.select_one("div.topic_content")
    if content_div:
        topic["content_rendered"] = str(content_div)
        topic["content"] = content_div.get_text(separator="\n", strip=True)

    meta = soup.select_one("div.header small.gray")
    if meta:
        topic["meta"] = meta.get_text(strip=True)

    supplements = []
    for s in soup.select("div.subtle"):
        text_div = s.select_one("div.topic_content")
        if text_div:
            supplements.append(text_div.get_text(separator="\n", strip=True))
    if supplements:
        topic["supplements"] = supplements

    replies = []
    for cell in soup.select("div.cell[id^='r_']"):
        reply = {}
        reply_id_str = cell.get("id", "").replace("r_", "")
        if reply_id_str.isdigit():
            reply["id"] = int(reply_id_str)
        username_el = cell.select_one("strong a.dark")
        if username_el:
            reply["member"] = username_el.get_text(strip=True)
        content_el = cell.select_one("div.reply_content")
        if content_el:
            reply["content_rendered"] = str(content_el)
            reply["content"] = content_el.get_text(separator="\n", strip=True)
        no_el = cell.select_one("span.no")
        if no_el:
            reply["floor"] = no_el.get_text(strip=True)
        ago_el = cell.select_one("span.ago")
        if ago_el:
            reply["time"] = ago_el.get_text(strip=True)
        thank_el = cell.select_one("span.small.fade")
        if thank_el:
            text = thank_el.get_text(strip=True)
            if text:
                reply["thanks"] = text
        replies.append(reply)

    return topic, replies


def parse_notifications_page(html):
    soup = BeautifulSoup(html, "html.parser")
    notifications = []
    for cell in soup.select("div.cell[id^='n_']"):
        n = {}
        nid = cell.get("id", "").replace("n_", "")
        if nid.isdigit():
            n["id"] = int(nid)
        payload = cell.select_one("span.payload")
        if payload:
            n["text"] = payload.get_text(separator=" ", strip=True)
        link = cell.select_one("a[href^='/member/']")
        if link:
            n["from_member"] = link.get_text(strip=True)
        topic_link = cell.select_one("a[href^='/t/']")
        if topic_link:
            n["topic_title"] = topic_link.get_text(strip=True)
            href = topic_link.get("href", "")
            tid = re.search(r"/t/(\d+)", href)
            if tid:
                n["topic_id"] = int(tid.group(1))
        ago = cell.select_one("span.snow")
        if ago:
            n["time"] = ago.get_text(strip=True)
        notifications.append(n)
    return notifications


def parse_balance_page(html):
    soup = BeautifulSoup(html, "html.parser")
    balance = {}
    balance_area = soup.select_one("div.balance_area")
    if balance_area:
        text = balance_area.get_text(strip=True)
        nums = re.findall(r"(\d+)", text)
        if len(nums) >= 3:
            balance["gold"] = int(nums[0])
            balance["silver"] = int(nums[1])
            balance["bronze"] = int(nums[2])
    return balance
