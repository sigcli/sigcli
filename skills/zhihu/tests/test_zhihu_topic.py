"""Tests for zhihu/scripts/zhihu_topic.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("zhihu", "zhihu_topic")

SAMPLE_SEARCH_RESPONSE = {
    "data": [
        {
            "object": {
                "id": 19550517,
                "name": "人工智能",
                "introduction": "人工智能（Artificial Intelligence）是研究如何使计算机模拟人类智能的学科。",
                "followers_count": 3500000,
                "questions_count": 120000,
                "avatar_url": "https://pic.zhimg.com/v2-topic.jpg",
            }
        }
    ]
}


class TestSearchTopic:
    @responses.activate
    def test_search_topic(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/search_v3"),
            json=SAMPLE_SEARCH_RESPONSE,
            status=200,
        )
        result = mod.search_topic("人工智能")
        assert result["count"] == 1
        assert result["topics"][0]["id"] == 19550517
        assert result["topics"][0]["name"] == "人工智能"
        assert result["topics"][0]["followers_count"] == 3500000

    @responses.activate
    def test_search_topic_empty(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/search_v3"),
            json={"data": []},
            status=200,
        )
        result = mod.search_topic("nonexistent")
        assert result["count"] == 0
        assert result["topics"] == []

    @responses.activate
    def test_search_topic_with_limit(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/search_v3"),
            json=SAMPLE_SEARCH_RESPONSE,
            status=200,
        )
        result = mod.search_topic("AI", limit=5)
        assert result["count"] == 1
