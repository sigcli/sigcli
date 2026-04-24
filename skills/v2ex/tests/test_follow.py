"""Tests for v2ex/scripts/v2ex_follow.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_follow")

ONCE_PAGE = '<html><body><input type="hidden" name="once" value="55555"></body></html>'


class TestFollow:
    @responses.activate
    def test_follow_member(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/mission/daily"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/follow/1234"),
            status=200,
        )
        result = mod.follow_action("fakecookie", "follow", "1234")
        assert result["success"] is True
        assert result["action"] == "follow"
        assert result["member_id"] == 1234

    @responses.activate
    def test_block_member(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/mission/daily"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/block/5678"),
            status=200,
        )
        result = mod.follow_action("fakecookie", "block", "5678")
        assert result["success"] is True
        assert result["action"] == "block"

    def test_requires_cookie(self):
        from v2ex_client import V2exError

        try:
            mod.follow_action("", "follow", "1234")
            assert False, "Should have raised"
        except V2exError as e:
            assert e.code == "AUTH_REQUIRED"
