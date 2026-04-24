"""Tests for v2ex/scripts/v2ex_search.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_search")


class TestSearch:
    @responses.activate
    def test_basic_search(self):
        responses.get(
            url=re.compile(r"https://www\.sov2ex\.com/api/search"),
            json={
                "total": 1,
                "took": 5,
                "hits": [
                    {
                        "_source": {
                            "id": 100001,
                            "title": "Docker 部署最佳实践",
                            "content": "分享一下我的 Docker 部署经验...",
                            "node": "docker",
                            "member": "devops_guru",
                            "replies": 25,
                            "created": "2026-04-01T10:00:00",
                        }
                    }
                ],
            },
            status=200,
        )
        result = mod.search("Docker 部署")
        assert result["total"] == 1
        assert result["count"] == 1
        h = result["hits"][0]
        assert h["id"] == 100001
        assert h["title"] == "Docker 部署最佳实践"
        assert h["node"] == "docker"

    @responses.activate
    def test_empty_search(self):
        responses.get(
            url=re.compile(r"https://www\.sov2ex\.com/api/search"),
            json={"total": 0, "took": 1, "hits": []},
            status=200,
        )
        result = mod.search("nonexistent_query_xyz")
        assert result["total"] == 0
        assert result["count"] == 0
        assert result["hits"] == []

    @responses.activate
    def test_content_preview_truncation(self):
        long_content = "x" * 300
        responses.get(
            url=re.compile(r"https://www\.sov2ex\.com/api/search"),
            json={
                "total": 1,
                "took": 1,
                "hits": [{"_source": {"id": 1, "title": "Test", "content": long_content}}],
            },
            status=200,
        )
        result = mod.search("test")
        assert len(result["hits"][0]["content_preview"]) <= 200
