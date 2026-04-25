"""Tests for xiaohongshu/scripts/xhs_feed.py"""

import json
import re

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_feed")
client_mod = load_script("xiaohongshu", "xhs_client")

_FEED_STATE = {
    "feed": {
        "feeds": [
            {
                "id": "ccc333000000000000000001",
                "note_card": {
                    "display_title": "推荐笔记1",
                    "type": "normal",
                    "user": {"nickname": "热门作者"},
                    "interact_info": {"liked_count": "1000"},
                },
            },
            {
                "id": "ccc333000000000000000002",
                "note_card": {
                    "display_title": "推荐笔记2",
                    "type": "video",
                    "user": {"nickname": "视频达人"},
                    "interact_info": {"liked_count": "500"},
                },
            },
            {
                "id": "ccc333000000000000000003",
                "note_card": {
                    "display_title": "推荐笔记3",
                    "type": "normal",
                    "user": {"nickname": "美食博主"},
                    "interact_info": {"liked_count": "300"},
                },
            },
        ]
    }
}

_SSR_HTML = (
    "<html><script>window.__INITIAL_STATE__="
    + json.dumps(_FEED_STATE)
    + "</script></html>"
)


@responses.activate
def test_get_feed_returns_notes():
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/explore"), body=_SSR_HTML, status=200)

    client = client_mod.XhsClient()
    result = mod.get_feed(client)

    assert result["source"] == "explore"
    assert result["count"] == 3
    assert result["notes"][0]["title"] == "推荐笔记1"
    assert result["notes"][0]["author"] == "热门作者"
    assert result["notes"][0]["likes"] == 1000


@responses.activate
def test_get_feed_respects_limit():
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/explore"), body=_SSR_HTML, status=200)

    client = client_mod.XhsClient()
    result = mod.get_feed(client, limit=2)

    assert result["count"] == 2
    assert len(result["notes"]) == 2


@responses.activate
def test_get_feed_empty():
    empty_html = (
        "<html><script>window.__INITIAL_STATE__="
        + json.dumps({"feed": {"feeds": []}})
        + "</script></html>"
    )
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/explore"), body=empty_html, status=200)

    client = client_mod.XhsClient()
    result = mod.get_feed(client)

    assert result["count"] == 0
    assert result["notes"] == []
