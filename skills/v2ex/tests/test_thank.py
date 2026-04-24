"""Tests for v2ex/scripts/v2ex_thank.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_thank")

ONCE_PAGE = '<html><body><input type="hidden" name="once" value="77777"></body></html>'


class TestThank:
    @responses.activate
    def test_thank_topic(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/mission/daily"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.post(
            url=re.compile(r"https://www\.v2ex\.com/thank/topic/12345"),
            json={"success": True},
            status=200,
        )
        result = mod.thank("fakecookie", "topic", "12345")
        assert result["success"] is True
        assert result["type"] == "topic"
        assert result["id"] == 12345

    @responses.activate
    def test_thank_reply(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/mission/daily"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.post(
            url=re.compile(r"https://www\.v2ex\.com/thank/reply/500001"),
            json={"success": True},
            status=200,
        )
        result = mod.thank("fakecookie", "reply", "500001")
        assert result["success"] is True
        assert result["type"] == "reply"

    def test_requires_cookie(self):
        from v2ex_client import V2exError

        try:
            mod.thank("", "topic", "12345")
            assert False, "Should have raised"
        except V2exError as e:
            assert e.code == "AUTH_REQUIRED"
