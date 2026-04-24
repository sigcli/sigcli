"""Tests for reddit/scripts/reddit_subscribe.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_subscribe")
client_mod = load_script("reddit", "reddit_client")

FAKE_COOKIE = "token_v2=faketoken123; reddit_session=fakesession"


@responses.activate
def test_subscribe():
    responses.post(url=re.compile(r"https://oauth\.reddit\.com/api/subscribe"), json={}, status=200)
    result = mod.subscribe(FAKE_COOKIE, "python")
    assert result["success"] is True
    assert result["action"] == "sub"
    assert "Subscribed" in result["message"]


@responses.activate
def test_unsubscribe():
    responses.post(url=re.compile(r"https://oauth\.reddit\.com/api/subscribe"), json={}, status=200)
    result = mod.subscribe(FAKE_COOKIE, "python", undo=True)
    assert result["action"] == "unsub"
    assert "Unsubscribed" in result["message"]


def test_requires_cookie():
    try:
        mod.subscribe("", "python")
        assert False
    except client_mod.RedditApiError as e:
        assert e.code == "AUTH_REQUIRED"
