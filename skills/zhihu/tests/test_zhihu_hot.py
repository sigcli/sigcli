"""Tests for zhihu/scripts/zhihu_hot.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("zhihu", "zhihu_hot")

SAMPLE_HOT_ITEM = {
    "target": {
        "id": 12345,
        "title": "如何评价 Python 3.13 的新特性？",
        "excerpt": "最近 Python 3.13 发布了，带来了很多新特性...",
        "answer_count": 128,
        "follower_count": 5600,
        "created": 1714000000,
    },
    "detail_text": "832 万热度",
}


class TestGetHot:
    @responses.activate
    def test_hot_list(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v3/feed/topstory/hot-lists/total"),
            json={"data": [SAMPLE_HOT_ITEM]},
            status=200,
        )
        result = mod.get_hot()
        assert result["count"] == 1
        item = result["items"][0]
        assert item["id"] == 12345
        assert item["title"] == "如何评价 Python 3.13 的新特性？"
        assert item["heat"] == "832 万热度"
        assert item["answer_count"] == 128

    @responses.activate
    def test_hot_empty(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v3/feed/topstory/hot-lists/total"),
            json={"data": []},
            status=200,
        )
        result = mod.get_hot()
        assert result["count"] == 0
        assert result["items"] == []

    @responses.activate
    def test_hot_with_limit(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v3/feed/topstory/hot-lists/total"),
            json={"data": [SAMPLE_HOT_ITEM, SAMPLE_HOT_ITEM]},
            status=200,
        )
        result = mod.get_hot(limit=10)
        assert result["count"] == 2
