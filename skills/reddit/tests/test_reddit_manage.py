"""Tests for reddit/scripts/reddit_manage.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_manage")
client_mod = load_script("reddit", "reddit_client")

FAKE_COOKIE = "token_v2=faketoken123; reddit_session=fakesession"


@responses.activate
def test_edit_post():
    responses.post(
        url=re.compile(r"https://oauth\.reddit\.com/api/editusertext"),
        json={"json": {"errors": [], "data": {}}},
        status=200,
    )
    result = mod.edit_post(FAKE_COOKIE, "t3_abc123", "Updated text")
    assert result["success"] is True
    assert result["action"] == "edited"


@responses.activate
def test_edit_comment():
    responses.post(
        url=re.compile(r"https://oauth\.reddit\.com/api/editusertext"),
        json={"json": {"errors": [], "data": {}}},
        status=200,
    )
    result = mod.edit_post(FAKE_COOKIE, "t1_comment1", "Edited comment")
    assert result["id"] == "t1_comment1"


@responses.activate
def test_edit_adds_prefix():
    responses.post(
        url=re.compile(r"https://oauth\.reddit\.com/api/editusertext"),
        json={"json": {"errors": [], "data": {}}},
        status=200,
    )
    result = mod.edit_post(FAKE_COOKIE, "barepost", "New text")
    assert result["id"] == "t3_barepost"


@responses.activate
def test_delete_post():
    responses.post(
        url=re.compile(r"https://oauth\.reddit\.com/api/del"),
        json={},
        status=200,
    )
    result = mod.delete_post(FAKE_COOKIE, "t3_abc123")
    assert result["success"] is True
    assert result["action"] == "deleted"


@responses.activate
def test_edit_errors_raised():
    responses.post(
        url=re.compile(r"https://oauth\.reddit\.com/api/editusertext"),
        json={"json": {"errors": [["NOT_AUTHOR", "not the author"]], "data": {}}},
        status=200,
    )
    try:
        mod.edit_post(FAKE_COOKIE, "t3_abc", "text")
        assert False, "Should have raised"
    except client_mod.RedditApiError as e:
        assert e.code == "EDIT_FAILED"


def test_requires_cookie():
    try:
        mod.edit_post("", "t3_abc", "text")
        assert False
    except client_mod.RedditApiError as e:
        assert e.code == "AUTH_REQUIRED"
