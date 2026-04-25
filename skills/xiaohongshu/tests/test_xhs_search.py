"""Tests for xiaohongshu/scripts/xhs_search.py"""

import json
import re

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_search")
client_mod = load_script("xiaohongshu", "xhs_client")

_SEARCH_STATE = {
    "search": {
        "feeds": [
            {
                "id": "aaa111000000000000000001",
                "note_card": {
                    "display_title": "搜索结果1",
                    "type": "normal",
                    "user": {"nickname": "作者1"},
                    "interact_info": {"liked_count": "200"},
                },
            },
            {
                "id": "aaa111000000000000000002",
                "note_card": {
                    "display_title": "搜索结果2",
                    "type": "video",
                    "user": {"nickname": "作者2"},
                    "interact_info": {"liked_count": "50"},
                },
            },
        ]
    }
}

_SSR_HTML = (
    "<html><script>window.__INITIAL_STATE__="
    + json.dumps(_SEARCH_STATE)
    + "</script></html>"
)


@responses.activate
def test_search_returns_results():
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/search_result"), body=_SSR_HTML, status=200)

    client = client_mod.XhsClient()
    result = mod.search_notes(client, "美食")

    assert result["keyword"] == "美食"
    assert result["count"] == 2
    assert result["notes"][0]["title"] == "搜索结果1"
    assert result["notes"][0]["author"] == "作者1"
    assert result["notes"][0]["likes"] == 200


@responses.activate
def test_search_respects_limit():
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/search_result"), body=_SSR_HTML, status=200)

    client = client_mod.XhsClient()
    result = mod.search_notes(client, "美食", limit=1)

    assert result["count"] == 1
    assert len(result["notes"]) == 1


@responses.activate
def test_search_empty_results():
    empty_html = (
        "<html><script>window.__INITIAL_STATE__="
        + json.dumps({"search": {"feeds": []}})
        + "</script></html>"
    )
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/search_result"), body=empty_html, status=200)

    client = client_mod.XhsClient()
    result = mod.search_notes(client, "不存在的关键词")

    assert result["count"] == 0
    assert result["notes"] == []
