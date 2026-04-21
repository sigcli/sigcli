"""Tests for outlook/scripts/outlook_messages.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("outlook", "outlook_messages")

SAMPLE_MESSAGE = {
    "id": "msg1",
    "subject": "Q2 Report",
    "from": {"emailAddress": {"name": "Jane", "address": "jane@example.com"}},
    "toRecipients": [{"emailAddress": {"name": "Pal", "address": "pal@example.com"}}],
    "receivedDateTime": "2026-04-13T10:00:00Z",
    "bodyPreview": "Please review the attached report.",
    "isRead": False,
    "hasAttachments": True,
    "importance": "high",
}


class TestListMessages:
    @responses.activate
    def test_list_inbox(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*Inbox/messages"),
            json={"value": [SAMPLE_MESSAGE]},
            status=200,
        )
        result = mod.list_messages("token")
        assert result["count"] == 1
        assert result["folder"] == "Inbox"
        msg = result["messages"][0]
        assert msg["subject"] == "Q2 Report"
        assert msg["from"]["name"] == "Jane"
        assert msg["isRead"] is False
        assert msg["hasAttachments"] is True

    @responses.activate
    def test_list_with_filters(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"value": [SAMPLE_MESSAGE]},
            status=200,
        )
        result = mod.list_messages(
            "token", folder="SentItems", limit=5, since="2026-04-01", until="2026-04-13", unread_only=True
        )
        assert result["folder"] == "SentItems"
        # Verify filter params were included in the request
        req_url = responses.calls[0].request.url
        assert "isRead%20eq%20false" in req_url or "isRead+eq+false" in req_url or "isRead eq false" in req_url

    @responses.activate
    def test_has_more_flag(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"value": [SAMPLE_MESSAGE], "@odata.nextLink": "https://graph.microsoft.com/next"},
            status=200,
        )
        result = mod.list_messages("token")
        assert result["hasMore"] is True

    @responses.activate
    def test_no_more_results(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"value": []},
            status=200,
        )
        result = mod.list_messages("token")
        assert result["hasMore"] is False
        assert result["count"] == 0

    @responses.activate
    def test_body_preview_truncation(self):
        long_preview = "x" * 300
        msg = {**SAMPLE_MESSAGE, "bodyPreview": long_preview}
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"value": [msg]},
            status=200,
        )
        result = mod.list_messages("token")
        assert len(result["messages"][0]["bodyPreview"]) <= 200
