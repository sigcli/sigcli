"""Tests for v2ex/scripts/v2ex_favorite.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_favorite")

ONCE_PAGE = '<html><body><input type="hidden" name="once" value="66666"></body></html>'


class TestFavorite:
    @responses.activate
    def test_favorite_topic(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/mission/daily"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/favorite/topic/12345"),
            status=200,
        )
        result = mod.favorite("fakecookie", "topic", "12345")
        assert result["success"] is True
        assert result["action"] == "favorite"

    @responses.activate
    def test_unfavorite_node(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/mission/daily"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/unfavorite/node/90"),
            status=200,
        )
        result = mod.favorite("fakecookie", "node", "90", undo=True)
        assert result["success"] is True
        assert result["action"] == "unfavorite"

    def test_requires_cookie(self):
        from v2ex_client import V2exError

        try:
            mod.favorite("", "topic", "12345")
            assert False, "Should have raised"
        except V2exError as e:
            assert e.code == "AUTH_REQUIRED"
