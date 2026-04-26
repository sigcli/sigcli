"""Tests for hackernews/scripts/hn_comment.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_comment")
client_mod = load_script("hackernews", "hn_client")

FAKE_COOKIE = "user=testuser&token123"


@responses.activate
def test_post_comment():
    responses.get(url=re.compile(r"https://news\.ycombinator\.com/item"), body='<input name="hmac" value="fake_hmac">', status=200)
    responses.post(url=re.compile(r"https://news\.ycombinator\.com/comment"), status=302, headers={"Location": "item?id=12345"})
    client = client_mod.HnClient(FAKE_COOKIE)
    result = mod.post_comment(client, 12345, "Great post!")
    assert result["success"] is True
    assert result["parent"] == 12345


def test_comment_requires_cookie():
    client = client_mod.HnClient("")
    try:
        mod.post_comment(client, 12345, "Test")
        assert False, "Should have raised"
    except client_mod.HnApiError as e:
        assert e.code == "AUTH_REQUIRED"
