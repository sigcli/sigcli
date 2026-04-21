"""Tests for slack/scripts/slack_users.py"""

import responses

from test_helpers import load_script

mod = load_script("slack", "slack_users")
client_mod = load_script("slack", "slack_client")

# Reusable mock members payload
_MEMBERS = [
    {
        "id": "U1",
        "name": "john.smith",
        "real_name": "John Smith",
        "deleted": False,
        "is_bot": False,
        "profile": {
            "display_name": "JSmith",
            "email": "john@example.com",
            "title": "Engineer",
        },
    },
    {
        "id": "U2",
        "name": "botuser",
        "real_name": "Bot",
        "deleted": False,
        "is_bot": True,
        "profile": {"display_name": "", "email": "", "title": ""},
    },
    {
        "id": "U3",
        "name": "jane.doe",
        "real_name": "Jane Doe",
        "deleted": True,
        "is_bot": False,
        "profile": {
            "display_name": "JDoe",
            "email": "jane@example.com",
            "title": "Manager",
        },
    },
]


def _mock_users_list():
    """Register a mock for users.list returning the standard member set."""
    responses.post(
        "https://slack.com/api/users.list",
        json={
            "ok": True,
            "members": _MEMBERS,
            "response_metadata": {"next_cursor": ""},
        },
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@responses.activate
def test_search_users_finds_by_name():
    """Searching by username returns the matching user."""
    _mock_users_list()

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_users(client, "john.smith", limit=10)

    assert result["query"] == "john.smith"
    assert result["count"] == 1
    assert result["users"][0]["id"] == "U1"
    assert result["users"][0]["name"] == "john.smith"


@responses.activate
def test_search_users_finds_by_email():
    """Searching by email returns the matching user."""
    _mock_users_list()

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_users(client, "john@example.com", limit=10)

    assert result["count"] == 1
    assert result["users"][0]["email"] == "john@example.com"


@responses.activate
def test_search_users_finds_by_real_name():
    """Searching by real_name returns the matching user."""
    _mock_users_list()

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_users(client, "John Smith", limit=10)

    assert result["count"] == 1
    assert result["users"][0]["real_name"] == "John Smith"


@responses.activate
def test_search_users_finds_by_display_name():
    """Searching by display_name returns the matching user."""
    _mock_users_list()

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_users(client, "JSmith", limit=10)

    assert result["count"] == 1
    assert result["users"][0]["display_name"] == "JSmith"


@responses.activate
def test_search_users_excludes_bots():
    """Bot users are excluded even if query matches."""
    _mock_users_list()

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_users(client, "botuser", limit=10)

    assert result["count"] == 0
    assert result["users"] == []


@responses.activate
def test_search_users_excludes_deleted():
    """Deleted users are excluded even if query matches."""
    _mock_users_list()

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_users(client, "jane.doe", limit=10)

    assert result["count"] == 0
    assert result["users"] == []


@responses.activate
def test_search_users_case_insensitive():
    """Search is case-insensitive across all matched fields."""
    _mock_users_list()

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")

    # Uppercase query should still match lowercase name
    result = mod.search_users(client, "JOHN", limit=10)
    assert result["count"] == 1
    assert result["users"][0]["id"] == "U1"


@responses.activate
def test_search_users_respects_limit():
    """Limit caps the number of returned users."""
    # Add several matching users
    many_members = [
        {
            "id": f"U{i}",
            "name": f"dev{i}",
            "real_name": f"Developer {i}",
            "deleted": False,
            "is_bot": False,
            "profile": {
                "display_name": f"Dev{i}",
                "email": f"dev{i}@example.com",
                "title": "SDE",
            },
        }
        for i in range(10)
    ]
    responses.post(
        "https://slack.com/api/users.list",
        json={
            "ok": True,
            "members": many_members,
            "response_metadata": {"next_cursor": ""},
        },
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_users(client, "dev", limit=3)

    assert result["count"] == 3
    assert len(result["users"]) == 3


# ---------------------------------------------------------------------------
# Enterprise edge fallback tests
# ---------------------------------------------------------------------------


@responses.activate
def test_search_users_enterprise_fallback():
    """Falls back to edge users/search on enterprise_is_restricted."""
    # users.list returns enterprise_is_restricted
    responses.post(
        "https://slack.com/api/users.list",
        json={"ok": False, "error": "enterprise_is_restricted"},
        status=200,
    )
    # auth.test for team_id
    responses.post(
        "https://slack.com/api/auth.test",
        json={"ok": True, "url": "https://test.slack.com/", "team_id": "T123", "user_id": "U1"},
        status=200,
    )
    # edge users/search
    responses.post(
        "https://edgeapi.slack.com/cache/T123/users/search",
        json={
            "ok": True,
            "results": [
                {
                    "id": "U1",
                    "name": "john.smith",
                    "real_name": "John Smith",
                    "deleted": False,
                    "is_bot": False,
                    "profile": {
                        "display_name": "JSmith",
                        "email": "john@example.com",
                        "title": "Engineer",
                    },
                },
            ],
        },
        status=200,
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_users(client, "john", limit=10)

    assert result["query"] == "john"
    assert result["count"] == 1
    assert result["users"][0]["id"] == "U1"
    assert result["users"][0]["name"] == "john.smith"
    assert result["users"][0]["email"] == "john@example.com"


@responses.activate
def test_search_users_edge_excludes_bots():
    """Edge fallback also excludes bots."""
    responses.post(
        "https://slack.com/api/users.list",
        json={"ok": False, "error": "enterprise_is_restricted"},
        status=200,
    )
    responses.post(
        "https://slack.com/api/auth.test",
        json={"ok": True, "url": "https://test.slack.com/", "team_id": "T123", "user_id": "U1"},
        status=200,
    )
    responses.post(
        "https://edgeapi.slack.com/cache/T123/users/search",
        json={
            "ok": True,
            "results": [
                {
                    "id": "U1",
                    "name": "botuser",
                    "real_name": "Bot",
                    "deleted": False,
                    "is_bot": True,
                    "profile": {"display_name": "", "email": "", "title": ""},
                },
            ],
        },
        status=200,
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.search_users(client, "bot", limit=10)

    assert result["count"] == 0
    assert result["users"] == []
