"""Tests for outlook/scripts/outlook_search.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("outlook", "outlook_search")

SAMPLE_MESSAGE = {
    "id": "msg1",
    "subject": "Weekly Report",
    "from": {"emailAddress": {"name": "Jane", "address": "jane@example.com"}},
    "toRecipients": [],
    "receivedDateTime": "2026-04-13T10:00:00Z",
    "bodyPreview": "Here is the weekly report.",
    "isRead": True,
    "hasAttachments": False,
    "importance": "normal",
}


class TestSearchMessages:
    @responses.activate
    def test_basic_search(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages"),
            json={"value": [SAMPLE_MESSAGE]},
            status=200,
        )
        result = mod.search_messages("token", "weekly report")
        assert result["count"] == 1
        assert result["query"] == "weekly report"
        assert result["folder"] is None
        assert result["messages"][0]["subject"] == "Weekly Report"

    @responses.activate
    def test_search_in_folder(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/mailFolders/SentItems/messages"),
            json={"value": []},
            status=200,
        )
        result = mod.search_messages("token", "report", folder="SentItems")
        assert result["folder"] == "SentItems"
        assert result["count"] == 0

    @responses.activate
    def test_search_has_more(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"value": [SAMPLE_MESSAGE], "@odata.nextLink": "https://next"},
            status=200,
        )
        result = mod.search_messages("token", "test")
        assert result["hasMore"] is True

    @responses.activate
    def test_search_query_in_params(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"value": []},
            status=200,
        )
        mod.search_messages("token", "from:jane subject:report")
        req_url = responses.calls[0].request.url
        assert "search" in req_url.lower()
