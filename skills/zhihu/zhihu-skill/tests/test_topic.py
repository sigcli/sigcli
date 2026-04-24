"""Tests for zhihu/scripts/zhihu_topic.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("zhihu", "zhihu_topic")

SAMPLE_TOPIC = {
    "id": 19550517,
    "name": "人工智能",
    "introduction": "人工智能（Artificial Intelligence）是研究如何使计算机模拟人类智能的学科。",
    "followers_count": 3500000,
    "questions_count": 120000,
    "best_answers_count": 8000,
    "avatar_url": "https://pic.zhimg.com/v2-topic.jpg",
}

SAMPLE_ESSENCE = {
    "data": [
        {
            "target": {
                "id": 67890,
                "type": "answer",
                "title": "",
                "question": {"title": "什么是深度学习？"},
                "excerpt": "深度学习是机器学习的一个分支...",
                "voteup_count": 2000,
            }
        }
    ]
}


class TestGetTopic:
    @responses.activate
    def test_topic_only(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/topics/19550517$"),
            json=SAMPLE_TOPIC,
            status=200,
        )
        result = mod.get_topic("19550517")
        t = result["topic"]
        assert t["id"] == 19550517
        assert t["name"] == "人工智能"
        assert t["followers_count"] == 3500000
        assert "essence" not in result

    @responses.activate
    def test_topic_with_essence(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/topics/19550517$"),
            json=SAMPLE_TOPIC,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/topics/19550517/feeds/essence"),
            json=SAMPLE_ESSENCE,
            status=200,
        )
        result = mod.get_topic("19550517", include_essence=True)
        assert result["topic"]["name"] == "人工智能"
        assert len(result["essence"]) == 1
        assert result["essence"][0]["title"] == "什么是深度学习？"
        assert result["essence"][0]["voteup_count"] == 2000

    @responses.activate
    def test_topic_essence_empty(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/topics/19550517$"),
            json=SAMPLE_TOPIC,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/topics/19550517/feeds/essence"),
            json={"data": []},
            status=200,
        )
        result = mod.get_topic("19550517", include_essence=True)
        assert result["essence"] == []
