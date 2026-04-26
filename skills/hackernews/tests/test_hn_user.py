"""Tests for hackernews/scripts/hn_user.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_user")

SAMPLE_USER = {
    "id": "pg",
    "created": 1160418111,
    "karma": 157236,
    "about": "Bug fixer.",
    "submitted": [40000001, 40000002],
}

SAMPLE_ITEM = {
    "id": 40000001,
    "type": "story",
    "by": "pg",
    "time": 1714000000,
    "title": "Lisp in Web Browsers",
    "url": "https://example.com/lisp",
    "text": "",
    "score": 300,
    "descendants": 100,
    "kids": [],
}


class TestGetUser:
    @responses.activate
    def test_profile_only(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/user/pg\.json"),
            json=SAMPLE_USER,
            status=200,
        )
        result = mod.get_user("pg")
        u = result["user"]
        assert u["id"] == "pg"
        assert u["karma"] == 157236
        assert u["about"] == "Bug fixer."
        assert "submissions" not in result

    @responses.activate
    def test_profile_with_submissions(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/user/pg\.json"),
            json=SAMPLE_USER,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/\d+\.json"),
            json=SAMPLE_ITEM,
            status=200,
        )
        result = mod.get_user("pg", include_submissions=True)
        assert result["user"]["id"] == "pg"
        assert len(result["submissions"]) == 2
        assert result["submissions"][0]["title"] == "Lisp in Web Browsers"

    @responses.activate
    def test_user_not_found(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/user/nonexistent\.json"),
            body="null",
            status=200,
            content_type="application/json",
        )
        result = mod.get_user("nonexistent")
        assert result["error"] == "NOT_FOUND"
