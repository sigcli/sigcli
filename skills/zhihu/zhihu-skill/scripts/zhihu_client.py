"""Shared Zhihu client — session management, API helpers, response parsers."""

import time

import requests

ZHIHU_API_V4 = "https://www.zhihu.com/api/v4"
ZHIHU_HOT_LIST_URL = "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

TIMEOUT = 15


class ZhihuError(Exception):
    def __init__(self, code, message=""):
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


class ZhihuClient:
    def __init__(self, cookie=""):
        self.cookie = cookie
        self._session = requests.Session()
        self._session.headers["User-Agent"] = USER_AGENT
        if cookie:
            self._session.headers["Cookie"] = cookie

    def get(self, url, params=None, timeout=TIMEOUT):
        resp = self._session.get(url, params=params, timeout=timeout)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "5"))
            time.sleep(retry_after)
            resp = self._session.get(url, params=params, timeout=timeout)
        resp.raise_for_status()
        return resp


def parse_question(q):
    if not q:
        return None
    return {
        "id": q.get("id"),
        "type": q.get("type", "question"),
        "title": q.get("title", ""),
        "detail": q.get("detail", ""),
        "answer_count": q.get("answer_count", 0),
        "comment_count": q.get("comment_count", 0),
        "follower_count": q.get("follower_count", 0),
        "created": q.get("created"),
        "updated": q.get("updated_time") or q.get("updated"),
        "url": q.get("url", ""),
        "author": _parse_author(q.get("author")),
    }


def parse_answer(a):
    if not a:
        return None
    return {
        "id": a.get("id"),
        "type": a.get("type", "answer"),
        "question": {
            "id": a.get("question", {}).get("id"),
            "title": a.get("question", {}).get("title", ""),
        } if a.get("question") else None,
        "author": _parse_author(a.get("author")),
        "content": a.get("content", ""),
        "excerpt": a.get("excerpt", ""),
        "voteup_count": a.get("voteup_count", 0),
        "comment_count": a.get("comment_count", 0),
        "created_time": a.get("created_time"),
        "updated_time": a.get("updated_time"),
    }


def parse_member(m):
    if not m:
        return None
    return {
        "id": m.get("id"),
        "name": m.get("name", ""),
        "url_token": m.get("url_token", ""),
        "avatar_url": m.get("avatar_url", ""),
        "headline": m.get("headline", ""),
        "description": m.get("description", ""),
        "gender": m.get("gender"),
        "follower_count": m.get("follower_count", 0),
        "following_count": m.get("following_count", 0),
        "answer_count": m.get("answer_count", 0),
        "articles_count": m.get("articles_count", 0),
        "voteup_count": m.get("voteup_count", 0),
    }


def parse_topic(t):
    if not t:
        return None
    return {
        "id": t.get("id"),
        "name": t.get("name", ""),
        "introduction": t.get("introduction", ""),
        "followers_count": t.get("followers_count", 0),
        "questions_count": t.get("questions_count", 0),
        "best_answers_count": t.get("best_answers_count", 0),
        "avatar_url": t.get("avatar_url", ""),
    }


def _parse_author(a):
    if not a:
        return None
    return {
        "name": a.get("name", ""),
        "url_token": a.get("url_token", ""),
        "avatar_url": a.get("avatar_url", ""),
        "headline": a.get("headline", ""),
    }
