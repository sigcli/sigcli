"""Tests for v2ex/scripts/v2ex_latest.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_latest")

SAMPLE_TOPIC = {
    "id": 200001,
    "title": "macOS 上最好用的终端是什么？",
    "url": "https://www.v2ex.com/t/200001",
    "content": "想换一个终端，大家有什么推荐？",
    "replies": 15,
    "created": 1714000000,
    "node": {"id": 12, "name": "apple", "title": "Apple"},
    "member": {"id": 5678, "username": "devuser", "avatar_normal": "https://cdn.v2ex.com/avatar2.png"},
}


class TestGetLatest:
    @responses.activate
    def test_latest_topics(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/topics/latest\.json"),
            json=[SAMPLE_TOPIC],
            status=200,
        )
        result = mod.get_latest()
        assert result["count"] == 1
        t = result["topics"][0]
        assert t["id"] == 200001
        assert t["replies"] == 15
        assert t["node"]["name"] == "apple"

    @responses.activate
    def test_latest_empty(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/topics/latest\.json"),
            json=[],
            status=200,
        )
        result = mod.get_latest()
        assert result["count"] == 0
