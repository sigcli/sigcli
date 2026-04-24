"""Tests for v2ex/scripts/v2ex_append.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_append")

ONCE_PAGE = '<html><body><input type="hidden" name="once" value="44444"></body></html>'


class TestAppendTopic:
    @responses.activate
    def test_append_success(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/t/12345"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.post(
            url=re.compile(r"https://www\.v2ex\.com/append/topic/12345"),
            status=302,
            headers={"Location": "/t/12345"},
        )
        result = mod.append_topic("fakecookie", "12345", "Update: found the solution!")
        assert result["success"] is True
        assert result["topic_id"] == 12345

    @responses.activate
    def test_append_not_owner(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/t/12345"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.post(
            url=re.compile(r"https://www\.v2ex\.com/append/topic/12345"),
            body="<html>不是你创建的主题</html>",
            status=200,
        )
        from v2ex_client import V2exError

        try:
            mod.append_topic("fakecookie", "12345", "Update")
            assert False, "Should have raised"
        except V2exError as e:
            assert e.code == "NOT_OWNER"

    def test_requires_cookie(self):
        from v2ex_client import V2exError

        try:
            mod.append_topic("", "12345", "Update")
            assert False, "Should have raised"
        except V2exError as e:
            assert e.code == "AUTH_REQUIRED"
