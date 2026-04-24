"""Tests for reddit/scripts/reddit_save.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_save")
client_mod = load_script("reddit", "reddit_client")

FAKE_COOKIE = "token_v2=faketoken123; reddit_session=fakesession"


@responses.activate
def test_save_post():
    responses.post(url=re.compile(r"https://oauth\.reddit\.com/api/save"), json={}, status=200)
    result = mod.save_post(FAKE_COOKIE, "t3_abc")
    assert result["success"] is True
    assert result["action"] == "saved"


@responses.activate
def test_unsave_post():
    responses.post(url=re.compile(r"https://oauth\.reddit\.com/api/unsave"), json={}, status=200)
    result = mod.save_post(FAKE_COOKIE, "t3_abc", undo=True)
    assert result["action"] == "unsaved"


@responses.activate
def test_bare_id_gets_prefix():
    responses.post(url=re.compile(r"https://oauth\.reddit\.com/api/save"), json={}, status=200)
    result = mod.save_post(FAKE_COOKIE, "abc")
    assert result["id"] == "t3_abc"


def test_requires_cookie():
    try:
        mod.save_post("", "t3_abc")
        assert False
    except client_mod.RedditApiError as e:
        assert e.code == "AUTH_REQUIRED"
