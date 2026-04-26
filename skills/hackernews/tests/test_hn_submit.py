"""Tests for hackernews/scripts/hn_submit.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_submit")
client_mod = load_script("hackernews", "hn_client")

FAKE_COOKIE = "user=testuser&token123"


@responses.activate
def test_submit_story():
    responses.get(url=re.compile(r"https://news\.ycombinator\.com/submit"), body='<input name="fnid" value="fake_fnid_123">', status=200)
    responses.post(url=re.compile(r"https://news\.ycombinator\.com/r"), status=302, headers={"Location": "/newest"})
    client = client_mod.HnClient(FAKE_COOKIE)
    result = mod.submit_story(client, "Test Title", url="https://example.com")
    assert result["success"] is True
    assert result["title"] == "Test Title"


def test_submit_requires_cookie():
    client = client_mod.HnClient("")
    try:
        mod.submit_story(client, "Test")
        assert False, "Should have raised"
    except client_mod.HnApiError as e:
        assert e.code == "AUTH_REQUIRED"
