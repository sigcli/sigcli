"""Tests for v2ex/scripts/v2ex_hot.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_hot")

SAMPLE_TOPIC = {
    "id": 100001,
    "title": "Python 3.13 有什么新特性？",
    "url": "https://www.v2ex.com/t/100001",
    "content": "最近看到 Python 3.13 发布了，想了解一下新特性。",
    "replies": 42,
    "created": 1714000000,
    "last_modified": 1714003600,
    "last_touched": 1714003600,
    "node": {"id": 90, "name": "python", "title": "Python"},
    "member": {"id": 1234, "username": "testuser", "avatar_normal": "https://cdn.v2ex.com/avatar.png"},
}


class TestGetHot:
    @responses.activate
    def test_hot_topics(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/topics/hot\.json"),
            json=[SAMPLE_TOPIC],
            status=200,
        )
        result = mod.get_hot()
        assert result["count"] == 1
        t = result["topics"][0]
        assert t["id"] == 100001
        assert t["title"] == "Python 3.13 有什么新特性？"
        assert t["node"]["name"] == "python"
        assert t["member"]["username"] == "testuser"

    @responses.activate
    def test_hot_empty(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/topics/hot\.json"),
            json=[],
            status=200,
        )
        result = mod.get_hot()
        assert result["count"] == 0
        assert result["topics"] == []

    @responses.activate
    def test_content_preview_truncation(self):
        long_content = "x" * 300
        topic = {**SAMPLE_TOPIC, "content": long_content}
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/topics/hot\.json"),
            json=[topic],
            status=200,
        )
        result = mod.get_hot()
        assert len(result["topics"][0]["content_preview"]) <= 200
