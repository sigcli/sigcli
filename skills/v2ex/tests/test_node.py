"""Tests for v2ex/scripts/v2ex_node.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_node")

SAMPLE_NODE = {
    "id": 90,
    "name": "python",
    "title": "Python",
    "title_alternative": "Python",
    "header": "All about Python",
    "topics": 5000,
    "stars": 1200,
    "parent_node_name": "programming",
}

SAMPLE_TOPIC = {
    "id": 300001,
    "title": "Flask vs FastAPI",
    "url": "https://www.v2ex.com/t/300001",
    "content": "Which one should I use?",
    "replies": 30,
    "created": 1714000000,
    "node": {"id": 90, "name": "python", "title": "Python"},
    "member": {"id": 9999, "username": "webdev", "avatar_normal": "https://cdn.v2ex.com/c.png"},
}


class TestListAllNodes:
    @responses.activate
    def test_list_all(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/nodes/all\.json"),
            json=[SAMPLE_NODE],
            status=200,
        )
        result = mod.list_all_nodes()
        assert result["count"] == 1
        assert result["nodes"][0]["name"] == "python"
        assert result["nodes"][0]["topics"] == 5000


class TestGetNode:
    @responses.activate
    def test_get_node_with_topics(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/nodes/show\.json"),
            json=SAMPLE_NODE,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/topics/show\.json"),
            json=[SAMPLE_TOPIC],
            status=200,
        )
        result = mod.get_node("python")
        assert result["node"]["name"] == "python"
        assert result["node"]["topics_count"] == 5000
        assert result["topics"]["count"] == 1
        assert result["topics"]["items"][0]["title"] == "Flask vs FastAPI"
