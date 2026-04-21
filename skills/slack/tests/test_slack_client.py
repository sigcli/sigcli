"""Tests for slack/scripts/slack_client.py"""

import json
import time
from unittest.mock import MagicMock

import pytest
import responses

from test_helpers import load_script

mod = load_script("slack", "slack_client")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SIG_CMD = ["sig", "get", "app-slack", "--format", "json"]

VALID_SIG_STDOUT = json.dumps(
    {
        "credential": {
            "localStorage": {"xoxc-token": "xoxc-fake-token-123"},
            "value": "d=xoxd-fake%2Ftoken; other=abc",
        }
    }
)


def _make_sig_result(stdout=VALID_SIG_STDOUT, returncode=0, stderr=""):
    """Build a mock subprocess.CompletedProcess for sig CLI."""
    result = MagicMock()
    result.stdout = stdout
    result.returncode = returncode
    result.stderr = stderr
    return result


def _make_client(xoxc="xoxc-test", cookies="d=xoxd-test; other=abc"):
    """Create a SlackClient without calling Signet."""
    return mod.SlackClient(xoxc, cookies)


# ---------------------------------------------------------------------------
# _parse_cookie_value
# ---------------------------------------------------------------------------


class TestParseCookieValue:
    def test_extracts_d_cookie(self):
        cookie = "d=xoxd-fake%2Ftoken; other=abc; path=/"
        assert mod._parse_cookie_value(cookie, "d") == "xoxd-fake%2Ftoken"

    def test_extracts_middle_cookie(self):
        cookie = "first=1; target=hello; last=3"
        assert mod._parse_cookie_value(cookie, "target") == "hello"

    def test_missing_cookie_returns_none(self):
        cookie = "a=1; b=2"
        assert mod._parse_cookie_value(cookie, "d") is None

    def test_empty_string_returns_none(self):
        assert mod._parse_cookie_value("", "d") is None


# ---------------------------------------------------------------------------
# get_slack_credentials
# ---------------------------------------------------------------------------


class TestGetSlackCredentials:
    def test_happy_path(self, monkeypatch):
        monkeypatch.setenv("SIG_APP_SLACK_COOKIE", "d=xoxd-fake%2Ftoken; other=abc")
        monkeypatch.setenv("SIG_APP_SLACK_LOCAL_XOXC_TOKEN", "xoxc-fake-token-123")
        xoxc, cookies = mod.get_slack_credentials()
        assert xoxc == "xoxc-fake-token-123"
        assert "d=xoxd-fake%2Ftoken" in cookies
        assert "other=abc" in cookies

    def test_missing_env_vars_returns_empty(self, monkeypatch):
        """When no env vars are set, returns empty strings (proxy mode supported)."""
        monkeypatch.delenv("SIG_APP_SLACK_COOKIE", raising=False)
        monkeypatch.delenv("SIG_APP_SLACK_LOCAL_XOXC_TOKEN", raising=False)
        xoxc, cookies = mod.get_slack_credentials()
        assert xoxc == ""
        assert cookies == ""

    def test_missing_xoxc_returns_empty(self, monkeypatch):
        """When xoxc is missing, returns empty strings (proxy mode supported)."""
        monkeypatch.setenv("SIG_APP_SLACK_COOKIE", "d=xoxd-fake%2Ftoken")
        monkeypatch.delenv("SIG_APP_SLACK_LOCAL_XOXC_TOKEN", raising=False)
        xoxc, cookies = mod.get_slack_credentials()
        assert xoxc == ""

    def test_missing_cookie_returns_empty(self, monkeypatch):
        """When cookie is missing, returns empty strings (proxy mode supported)."""
        monkeypatch.delenv("SIG_APP_SLACK_COOKIE", raising=False)
        monkeypatch.setenv("SIG_APP_SLACK_LOCAL_XOXC_TOKEN", "xoxc-good")
        xoxc, cookies = mod.get_slack_credentials()
        assert cookies == ""

    def test_missing_d_cookie_raises(self, monkeypatch):
        monkeypatch.setenv("SIG_APP_SLACK_COOKIE", "other=abc")
        monkeypatch.setenv("SIG_APP_SLACK_LOCAL_XOXC_TOKEN", "xoxc-good")
        with pytest.raises(RuntimeError, match="Cookie 'd' not found"):
            mod.get_slack_credentials()


# ---------------------------------------------------------------------------
# SlackClient.api_call
# ---------------------------------------------------------------------------


class TestApiCall:
    @responses.activate
    def test_returns_json_on_ok(self):
        responses.post(
            "https://slack.com/api/auth.test",
            json={"ok": True, "user": "U123"},
            status=200,
        )
        client = _make_client()
        data = client.api_call("auth.test")
        assert data["ok"] is True
        assert data["user"] == "U123"

    @responses.activate
    def test_token_sent_as_form_param(self):
        responses.post(
            "https://slack.com/api/auth.test",
            json={"ok": True},
            status=200,
        )
        client = _make_client(xoxc="xoxc-my-token")
        client.api_call("auth.test")
        body = responses.calls[0].request.body
        assert "token=xoxc-my-token" in body

    @responses.activate
    def test_raises_on_ok_false(self):
        responses.post(
            "https://slack.com/api/auth.test",
            json={"ok": False, "error": "invalid_auth"},
            status=200,
        )
        client = _make_client()
        with pytest.raises(mod.SlackApiError) as exc_info:
            client.api_call("auth.test")
        assert exc_info.value.error_code == "invalid_auth"

    @responses.activate
    def test_extra_params_forwarded(self):
        responses.post(
            "https://slack.com/api/conversations.list",
            json={"ok": True, "channels": []},
            status=200,
        )
        client = _make_client()
        client.api_call("conversations.list", {"types": "public_channel", "limit": "100"})
        body = responses.calls[0].request.body
        assert "types=public_channel" in body
        assert "limit=100" in body


# ---------------------------------------------------------------------------
# SlackClient.webclient_call
# ---------------------------------------------------------------------------


class TestWebclientCall:
    @responses.activate
    def test_uses_workspace_url(self):
        responses.post(
            "https://test.slack.com/api/client.counts",
            json={"ok": True, "counts": {}},
            status=200,
        )
        client = _make_client()
        client._workspace_url = "https://test.slack.com/"
        data = client.webclient_call("client.counts")
        assert data["ok"] is True
        assert responses.calls[0].request.url == "https://test.slack.com/api/client.counts"

    @responses.activate
    def test_token_in_form(self):
        responses.post(
            "https://test.slack.com/api/search.modules",
            json={"ok": True},
            status=200,
        )
        client = _make_client(xoxc="xoxc-webclient")
        client._workspace_url = "https://test.slack.com/"
        client.webclient_call("search.modules")
        body = responses.calls[0].request.body
        assert "token=xoxc-webclient" in body

    @responses.activate
    def test_raises_on_ok_false(self):
        responses.post(
            "https://test.slack.com/api/search.modules",
            json={"ok": False, "error": "not_allowed"},
            status=200,
        )
        client = _make_client()
        client._workspace_url = "https://test.slack.com/"
        with pytest.raises(mod.SlackApiError) as exc_info:
            client.webclient_call("search.modules")
        assert exc_info.value.error_code == "not_allowed"


# ---------------------------------------------------------------------------
# resolve_channel
# ---------------------------------------------------------------------------


class TestResolveChannel:
    def test_raw_channel_id_returned_as_is(self):
        client = _make_client()
        assert mod.resolve_channel(client, "C123ABC") == "C123ABC"

    def test_raw_dm_id_returned_as_is(self):
        client = _make_client()
        assert mod.resolve_channel(client, "D456DEF") == "D456DEF"

    @responses.activate
    def test_hash_name_resolved_via_conversations_list(self):
        responses.post(
            "https://slack.com/api/conversations.list",
            json={
                "ok": True,
                "channels": [
                    {"id": "C999", "name": "general"},
                    {"id": "C888", "name": "random"},
                ],
                "response_metadata": {"next_cursor": ""},
            },
            status=200,
        )
        client = _make_client()
        result = mod.resolve_channel(client, "#general")
        assert result == "C999"

    @responses.activate
    def test_hash_name_not_found_raises(self):
        # Return empty results for both channel type queries
        responses.post(
            "https://slack.com/api/conversations.list",
            json={
                "ok": True,
                "channels": [],
                "response_metadata": {"next_cursor": ""},
            },
            status=200,
        )
        responses.post(
            "https://slack.com/api/conversations.list",
            json={
                "ok": True,
                "channels": [],
                "response_metadata": {"next_cursor": ""},
            },
            status=200,
        )
        client = _make_client()
        with pytest.raises(mod.SlackApiError) as exc_info:
            mod.resolve_channel(client, "#nonexistent")
        assert exc_info.value.error_code == "channel_not_found"

    @responses.activate
    def test_hash_name_enterprise_fallback_to_search(self):
        """On enterprise_is_restricted, falls back to search.modules.channels."""
        # conversations.list returns enterprise_is_restricted
        responses.post(
            "https://slack.com/api/conversations.list",
            json={"ok": False, "error": "enterprise_is_restricted"},
            status=200,
        )
        # auth.test for workspace URL
        responses.post(
            "https://slack.com/api/auth.test",
            json={"ok": True, "url": "https://test.slack.com/", "team_id": "T1", "user_id": "U1"},
            status=200,
        )
        # search.modules.channels fallback
        responses.post(
            "https://test.slack.com/api/search.modules.channels",
            json={
                "ok": True,
                "items": [
                    {"id": "C999", "name": "general"},
                    {"id": "C888", "name": "random"},
                ],
                "response_metadata": {"next_cursor": ""},
            },
            status=200,
        )
        client = _make_client()
        result = mod.resolve_channel(client, "#general")
        assert result == "C999"

    @responses.activate
    def test_at_user_enterprise_fallback_to_edge_search(self):
        """On enterprise_is_restricted for users.list, falls back to edge users/search."""
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
                "results": [{"id": "U999", "name": "alice", "profile": {}}],
            },
            status=200,
        )
        # conversations.open for DM
        responses.post(
            "https://slack.com/api/conversations.open",
            json={"ok": True, "channel": {"id": "D555"}},
            status=200,
        )
        client = _make_client()
        result = mod.resolve_channel(client, "@alice")
        assert result == "D555"


# ---------------------------------------------------------------------------
# edge_api_call
# ---------------------------------------------------------------------------


class TestEdgeApiCall:
    @responses.activate
    def test_posts_json_to_edge_url(self):
        """edge_api_call POSTs JSON to edgeapi.slack.com/cache/{team_id}/{path}."""
        # auth.test to get team_id
        responses.post(
            "https://slack.com/api/auth.test",
            json={"ok": True, "url": "https://test.slack.com/", "team_id": "T123", "user_id": "U1"},
            status=200,
        )
        responses.post(
            "https://edgeapi.slack.com/cache/T123/users/search",
            json={"ok": True, "results": [{"id": "U1", "name": "alice"}]},
            status=200,
        )
        client = _make_client()
        data = client.edge_api_call("users/search", {"query": "alice", "count": 10})
        assert data["ok"] is True
        assert len(data["results"]) == 1

    @responses.activate
    def test_raises_on_ok_false(self):
        """edge_api_call raises SlackApiError on ok=false."""
        responses.post(
            "https://slack.com/api/auth.test",
            json={"ok": True, "url": "https://test.slack.com/", "team_id": "T123", "user_id": "U1"},
            status=200,
        )
        responses.post(
            "https://edgeapi.slack.com/cache/T123/users/search",
            json={"ok": False, "error": "not_allowed"},
            status=200,
        )
        client = _make_client()
        with pytest.raises(mod.SlackApiError) as exc_info:
            client.edge_api_call("users/search", {"query": "x"})
        assert exc_info.value.error_code == "not_allowed"


# ---------------------------------------------------------------------------
# parse_limit
# ---------------------------------------------------------------------------


class TestParseLimit:
    def test_1d_returns_oldest_ts(self):
        before = time.time() - 86400
        count, oldest = mod.parse_limit("1d")
        after = time.time() - 86400
        assert count is None
        assert oldest is not None
        # oldest should be approximately now - 86400
        assert before <= oldest <= after + 1

    def test_7d_returns_oldest_ts(self):
        before = time.time() - 7 * 86400
        count, oldest = mod.parse_limit("7d")
        after = time.time() - 7 * 86400
        assert count is None
        assert oldest is not None
        assert before <= oldest <= after + 1

    def test_numeric_returns_count(self):
        count, oldest = mod.parse_limit("50")
        assert count == 50
        assert oldest is None

    def test_2h_returns_oldest_ts(self):
        before = time.time() - 2 * 3600
        count, oldest = mod.parse_limit("2h")
        after = time.time() - 2 * 3600
        assert count is None
        assert before <= oldest <= after + 1

    def test_30m_returns_oldest_ts(self):
        before = time.time() - 30 * 60
        count, oldest = mod.parse_limit("30m")
        after = time.time() - 30 * 60
        assert count is None
        assert before <= oldest <= after + 1

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError, match="Invalid --limit value"):
            mod.parse_limit("abc")

    def test_invalid_unit_raises(self):
        with pytest.raises(ValueError, match="Invalid --limit value"):
            mod.parse_limit("5x")


# ---------------------------------------------------------------------------
# format_message
# ---------------------------------------------------------------------------


class TestFormatMessage:
    def test_normal_message(self):
        msg = {
            "ts": "1700000000.000100",
            "user": "U123",
            "username": "alice",
            "text": "Hello world",
        }
        result = mod.format_message(msg)
        assert result is not None
        assert result["ts"] == "1700000000.000100"
        assert result["user"] == "U123"
        assert result["username"] == "alice"
        assert result["text"] == "Hello world"
        assert result["thread_ts"] is None
        assert result["reply_count"] == 0
        assert result["reactions"] is None
        assert result["subtype"] is None
        assert result["files"] is None

    def test_channel_join_filtered_by_default(self):
        msg = {
            "ts": "1700000000.000200",
            "user": "U456",
            "text": "<@U456> has joined the channel",
            "subtype": "channel_join",
        }
        result = mod.format_message(msg, include_activity=False)
        assert result is None

    def test_channel_join_included_when_flag_set(self):
        msg = {
            "ts": "1700000000.000200",
            "user": "U456",
            "text": "<@U456> has joined the channel",
            "subtype": "channel_join",
        }
        result = mod.format_message(msg, include_activity=True)
        assert result is not None
        assert result["subtype"] == "channel_join"
        assert result["user"] == "U456"

    def test_message_with_reactions(self):
        msg = {
            "ts": "1700000000.000300",
            "user": "U789",
            "text": "Great idea!",
            "reactions": [
                {"name": "thumbsup", "count": 3},
                {"name": "heart", "count": 1},
            ],
        }
        result = mod.format_message(msg)
        assert result is not None
        assert result["reactions"] == [
            {"name": "thumbsup", "count": 3},
            {"name": "heart", "count": 1},
        ]

    def test_message_with_thread(self):
        msg = {
            "ts": "1700000000.000400",
            "user": "U111",
            "text": "Thread parent",
            "thread_ts": "1700000000.000400",
            "reply_count": 5,
        }
        result = mod.format_message(msg)
        assert result is not None
        assert result["thread_ts"] == "1700000000.000400"
        assert result["reply_count"] == 5

    def test_message_with_files(self):
        msg = {
            "ts": "1700000000.000500",
            "user": "U222",
            "text": "See attachment",
            "files": [{"id": "F1"}, {"id": "F2"}],
        }
        result = mod.format_message(msg)
        assert result is not None
        assert result["files"] == 2

    def test_all_activity_subtypes_filtered(self):
        for subtype in mod.ACTIVITY_SUBTYPES:
            msg = {"ts": "1", "user": "U1", "text": "x", "subtype": subtype}
            assert mod.format_message(msg, include_activity=False) is None
