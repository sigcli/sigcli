"""Tests for v2ex/scripts/v2ex_member.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_member")

SAMPLE_MEMBER = {
    "id": 1,
    "username": "livid",
    "url": "https://www.v2ex.com/member/livid",
    "website": "https://livid.v2ex.com",
    "twitter": "livid",
    "github": "livid",
    "location": "San Francisco",
    "tagline": "V2EX Creator",
    "bio": "I created V2EX.",
    "avatar_large": "https://cdn.v2ex.com/avatar/large.png",
    "avatar_normal": "https://cdn.v2ex.com/avatar/normal.png",
    "created": 1272203146,
}

SAMPLE_TOPIC = {
    "id": 1,
    "title": "Welcome to V2EX",
    "url": "https://www.v2ex.com/t/1",
    "content": "Hello everyone",
    "replies": 100,
    "created": 1272203200,
    "node": {"id": 1, "name": "v2ex", "title": "V2EX"},
    "member": {"id": 1, "username": "livid", "avatar_normal": "https://cdn.v2ex.com/avatar/normal.png"},
}


class TestGetMember:
    @responses.activate
    def test_profile_only(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/members/show\.json"),
            json=SAMPLE_MEMBER,
            status=200,
        )
        result = mod.get_member("livid")
        m = result["member"]
        assert m["username"] == "livid"
        assert m["github"] == "livid"
        assert m["location"] == "San Francisco"
        assert "topics" not in result

    @responses.activate
    def test_profile_with_topics(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/members/show\.json"),
            json=SAMPLE_MEMBER,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/topics/show\.json"),
            json=[SAMPLE_TOPIC],
            status=200,
        )
        result = mod.get_member("livid", include_topics=True)
        assert result["member"]["username"] == "livid"
        assert result["topics"]["count"] == 1
        assert result["topics"]["items"][0]["title"] == "Welcome to V2EX"
