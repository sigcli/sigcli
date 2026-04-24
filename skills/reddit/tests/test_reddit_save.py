"""Tests for reddit/scripts/reddit_save.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_save")
client_mod = load_script("reddit", "reddit_client")


@responses.activate
def test_save_post():
    responses.get(url=re.compile(r"https://www\.reddit\.com/api/me\.json"), json={"data": {"modhash": "mh1"}}, status=200)
    responses.post(url=re.compile(r"https://www\.reddit\.com/api/save"), json={}, status=200)
    result = mod.save_post("fakecookie", "t3_abc")
    assert result["success"] is True
    assert result["action"] == "saved"


@responses.activate
def test_unsave_post():
    responses.get(url=re.compile(r"https://www\.reddit\.com/api/me\.json"), json={"data": {"modhash": "mh1"}}, status=200)
    responses.post(url=re.compile(r"https://www\.reddit\.com/api/unsave"), json={}, status=200)
    result = mod.save_post("fakecookie", "t3_abc", undo=True)
    assert result["action"] == "unsaved"


@responses.activate
def test_bare_id_gets_prefix():
    responses.get(url=re.compile(r"https://www\.reddit\.com/api/me\.json"), json={"data": {"modhash": "mh1"}}, status=200)
    responses.post(url=re.compile(r"https://www\.reddit\.com/api/save"), json={}, status=200)
    result = mod.save_post("fakecookie", "abc")
    assert result["id"] == "t3_abc"


def test_requires_cookie():
    try:
        mod.save_post("", "t3_abc")
        assert False
    except client_mod.RedditApiError as e:
        assert e.code == "AUTH_REQUIRED"
