"""Tests for v2ex/scripts/v2ex_reply.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_reply")

ONCE_PAGE = '<html><body><input type="hidden" name="once" value="88888"></body></html>'


class TestReplyTopic:
    @responses.activate
    def test_reply_success(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/t/12345"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.post(
            url=re.compile(r"https://www\.v2ex\.com/t/12345"),
            status=302,
            headers={"Location": "/t/12345#reply100"},
        )
        result = mod.reply_topic("fakecookie", "12345", "Great post!")
        assert result["success"] is True
        assert result["topic_id"] == 12345

    @responses.activate
    def test_reply_rate_limited(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/t/12345"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.post(
            url=re.compile(r"https://www\.v2ex\.com/t/12345"),
            body="<html>你上一次回复是在 30 秒前</html>",
            status=200,
        )
        from v2ex_client import V2exError

        try:
            mod.reply_topic("fakecookie", "12345", "Hello")
            assert False, "Should have raised"
        except V2exError as e:
            assert e.code == "RATE_LIMITED"

    def test_requires_cookie(self):
        from v2ex_client import V2exError

        try:
            mod.reply_topic("", "12345", "Hello")
            assert False, "Should have raised"
        except V2exError as e:
            assert e.code == "AUTH_REQUIRED"
