"""Tests for outlook/scripts/outlook_send.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("outlook", "outlook_send")


class TestCreateDraft:
    @responses.activate
    def test_create_draft(self):
        responses.post(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages"),
            json={"id": "draft1", "webLink": "https://outlook.office365.com/owa/?ItemID=draft1"},
            status=201,
        )
        result = mod.create_draft("token", "jane@example.com", "Test Subject", "Hello Jane")
        assert result["success"] is True
        assert result["draftId"] == "draft1"
        assert result["to"] == ["jane@example.com"]
        assert result["subject"] == "Test Subject"
        assert "webLink" in result

    @responses.activate
    def test_create_draft_with_cc_bcc(self):
        responses.post(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"id": "draft2", "webLink": ""},
            status=201,
        )
        result = mod.create_draft("token", "jane@example.com", "Subject", "Body", cc="bob@example.com", bcc="alice@example.com")
        assert result["success"] is True
        assert result["cc"] == ["bob@example.com"]
        # Verify CC and BCC in request body
        body = responses.calls[0].request.body
        if isinstance(body, bytes):
            body = body.decode()
        assert "bob@example.com" in body
        assert "alice@example.com" in body

    @responses.activate
    def test_create_draft_html_body(self):
        responses.post(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"id": "draft3", "webLink": ""},
            status=201,
        )
        result = mod.create_draft("token", "jane@example.com", "Subject", "<b>Bold</b>", body_type="html")
        assert result["success"] is True
        body = responses.calls[0].request.body
        if isinstance(body, bytes):
            body = body.decode()
        assert "HTML" in body

    @responses.activate
    def test_multiple_recipients(self):
        responses.post(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"id": "draft4", "webLink": ""},
            status=201,
        )
        result = mod.create_draft("token", "jane@example.com, bob@example.com", "Subject", "Body")
        assert result["to"] == ["jane@example.com", "bob@example.com"]


class TestParseRecipients:
    def test_single(self):
        result = mod._parse_recipients("jane@example.com")
        assert len(result) == 1
        assert result[0]["emailAddress"]["address"] == "jane@example.com"

    def test_multiple(self):
        result = mod._parse_recipients("jane@example.com, bob@example.com")
        assert len(result) == 2

    def test_empty(self):
        assert mod._parse_recipients(None) == []
        assert mod._parse_recipients("") == []
