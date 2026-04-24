"""Tests for v2ex/scripts/v2ex_create.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_create")

ONCE_PAGE = '<html><body><input type="hidden" name="once" value="99999"></body></html>'


class TestCreateTopic:
    @responses.activate
    def test_create_success(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/new/python"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.post(
            url=re.compile(r"https://www\.v2ex\.com/write"),
            status=302,
            headers={"Location": "/t/123456"},
        )
        result = mod.create_topic("fakecookie", "python", "Test Title", "Test content")
        assert result["success"] is True
        assert result["topic_id"] == 123456
        assert "/t/123456" in result["url"]

    @responses.activate
    def test_create_rate_limited(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/new/python"),
            body=ONCE_PAGE,
            status=200,
        )
        responses.post(
            url=re.compile(r"https://www\.v2ex\.com/write"),
            body="<html>你上一次发布主题是在 5 分钟前</html>",
            status=200,
        )
        from v2ex_client import V2exError

        try:
            mod.create_topic("fakecookie", "python", "Title", "Content")
            assert False, "Should have raised"
        except V2exError as e:
            assert e.code == "RATE_LIMITED"

    def test_requires_cookie(self):
        from v2ex_client import V2exError

        try:
            mod.create_topic("", "python", "Title", "Content")
            assert False, "Should have raised"
        except V2exError as e:
            assert e.code == "AUTH_REQUIRED"
