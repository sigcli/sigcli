"""Tests for slack/scripts/slack_search.py"""

import pytest
import responses

from test_helpers import load_script

mod = load_script("slack", "slack_search")
client_mod = load_script("slack", "slack_client")


# ---------------------------------------------------------------------------
# build_search_query
# ---------------------------------------------------------------------------


def test_build_search_query_query_only():
    """Query-only input returns the query unchanged."""
    result = mod.build_search_query("deploy", None, None, None, None, None, False)
    assert result == "deploy"


def test_build_search_query_query_plus_channel():
    """Query + channel produces 'query in:#channel'."""
    result = mod.build_search_query("deploy", "#ops", None, None, None, None, False)
    assert result == "deploy in:#ops"


def test_build_search_query_from_user_only():
    """from_user alone produces 'from:@user'."""
    result = mod.build_search_query(None, None, "@john", None, None, None, False)
    assert result == "from:@john"


def test_build_search_query_all_filters():
    """All filters combined produce the correct compound query."""
    result = mod.build_search_query("error", "#alerts", "@jane", "2025-01-31", "2025-01-01", None, True)
    assert "error" in result
    assert "in:#alerts" in result
    assert "from:@jane" in result
    assert "before:2025-01-31" in result
    assert "after:2025-01-01" in result
    assert "is:thread" in result


def test_build_search_query_empty_raises():
    """Empty query with no filters raises ValueError."""
    with pytest.raises(ValueError, match="empty"):
        mod.build_search_query(None, None, None, None, None, None, False)


# ---------------------------------------------------------------------------
# cursor encode/decode round-trip
# ---------------------------------------------------------------------------


def test_cursor_round_trip():
    """encode then decode returns the original page number."""
    for page in (1, 2, 5, 100):
        encoded = mod.encode_search_cursor(page)
        assert mod.decode_search_cursor(encoded) == page


def test_decode_search_cursor_none_returns_1():
    """A None cursor decodes to page 1."""
    assert mod.decode_search_cursor(None) == 1


def test_decode_search_cursor_empty_returns_1():
    """An empty string cursor decodes to page 1."""
    assert mod.decode_search_cursor("") == 1


def test_decode_search_cursor_garbage_returns_1():
    """An invalid cursor falls back to page 1."""
    assert mod.decode_search_cursor("not-base64!!!") == 1


# ---------------------------------------------------------------------------
# search_messages (mocked HTTP)
# ---------------------------------------------------------------------------


@responses.activate
def test_search_messages_returns_formatted_results():
    """search_messages parses the Slack response into our output format."""
    responses.post(
        "https://slack.com/api/search.messages",
        json={
            "ok": True,
            "messages": {
                "total": 1,
                "matches": [
                    {
                        "ts": "123.456",
                        "channel": {"id": "C1", "name": "general"},
                        "user": "U1",
                        "text": "hello",
                        "permalink": "https://x.slack.com/p123",
                    }
                ],
                "pagination": {"page": 1, "page_count": 1},
            },
        },
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_messages(client, "hello", limit=20, page=1)

    assert result["query"] == "hello"
    assert result["total"] == 1
    assert result["count"] == 1
    assert result["next_cursor"] is None

    msg = result["messages"][0]
    assert msg["ts"] == "123.456"
    assert msg["channel"]["id"] == "C1"
    assert msg["channel"]["name"] == "general"
    assert msg["user"] == "U1"
    assert msg["text"] == "hello"
    assert msg["permalink"] == "https://x.slack.com/p123"


@responses.activate
def test_search_messages_pagination_cursor():
    """When more pages exist, next_cursor is populated."""
    responses.post(
        "https://slack.com/api/search.messages",
        json={
            "ok": True,
            "messages": {
                "total": 50,
                "matches": [
                    {
                        "ts": "1.0",
                        "channel": {"id": "C1", "name": "dev"},
                        "user": "U2",
                        "text": "page one",
                        "permalink": "https://x.slack.com/p1",
                    }
                ],
                "pagination": {"page": 1, "page_count": 3},
            },
        },
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_messages(client, "deploy", limit=20, page=1)

    assert result["next_cursor"] is not None
    # The cursor should decode to page 2
    assert mod.decode_search_cursor(result["next_cursor"]) == 2


@responses.activate
def test_search_messages_last_page_no_cursor():
    """On the final page, next_cursor is None."""
    responses.post(
        "https://slack.com/api/search.messages",
        json={
            "ok": True,
            "messages": {
                "total": 5,
                "matches": [],
                "pagination": {"page": 3, "page_count": 3},
            },
        },
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_messages(client, "query", limit=20, page=3)

    assert result["next_cursor"] is None
