"""Tests for zhihu/scripts/zhihu_search.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("zhihu", "zhihu_search")


class TestSearch:
    @responses.activate
    def test_basic_search(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/search_v3"),
            json={
                "paging": {"totals": 100},
                "data": [
                    {
                        "type": "search_result",
                        "object": {
                            "id": 12345,
                            "title": "机器学习入门指南",
                            "excerpt": "本文介绍机器学习的基本概念...",
                            "url": "https://www.zhihu.com/question/12345",
                        },
                    }
                ],
            },
            status=200,
        )
        result = mod.search("机器学习")
        assert result["total"] == 100
        assert result["count"] == 1
        r = result["results"][0]
        assert r["object"]["id"] == 12345
        assert r["object"]["title"] == "机器学习入门指南"

    @responses.activate
    def test_empty_search(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/search_v3"),
            json={"paging": {"totals": 0}, "data": []},
            status=200,
        )
        result = mod.search("nonexistent_query_xyz")
        assert result["total"] == 0
        assert result["count"] == 0
        assert result["results"] == []

    @responses.activate
    def test_search_with_type(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/search_v3"),
            json={
                "paging": {"totals": 1},
                "data": [
                    {
                        "type": "topic",
                        "object": {
                            "id": 19550517,
                            "name": "人工智能",
                            "excerpt": "",
                            "url": "https://www.zhihu.com/topic/19550517",
                        },
                    }
                ],
            },
            status=200,
        )
        result = mod.search("人工智能", search_type="topic")
        assert result["count"] == 1
        assert result["results"][0]["type"] == "topic"
