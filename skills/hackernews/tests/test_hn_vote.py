"""Tests for hackernews/scripts/hn_vote.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_vote")
client_mod = load_script("hackernews", "hn_client")

FAKE_COOKIE = "user=testuser&token123"


@responses.activate
def test_upvote():
    item_html = '<a id="up_12345" href="vote?id=12345&amp;how=up&amp;auth=fakeauth123">upvote</a>'
    responses.get(url=re.compile(r"https://news\.ycombinator\.com/item\?id=12345"), body=item_html, status=200)
    responses.get(url=re.compile(r"https://news\.ycombinator\.com/vote"), body="<html>voted</html>", status=200)
    client = client_mod.HnClient(FAKE_COOKIE)
    result = mod.upvote_item(client, 12345)
    assert result["success"] is True
    assert result["id"] == 12345


def test_vote_requires_cookie():
    client = client_mod.HnClient("")
    try:
        mod.upvote_item(client, 12345)
        assert False, "Should have raised"
    except client_mod.HnApiError as e:
        assert e.code == "AUTH_REQUIRED"
