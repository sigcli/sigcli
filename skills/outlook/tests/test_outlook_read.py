"""Tests for outlook/scripts/outlook_read.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("outlook", "outlook_read")


SAMPLE_FULL_MESSAGE = {
    "id": "msg1",
    "subject": "Hello",
    "from": {"emailAddress": {"name": "Jane", "address": "jane@example.com"}},
    "toRecipients": [{"emailAddress": {"name": "Pal", "address": "pal@example.com"}}],
    "ccRecipients": [{"emailAddress": {"name": "Bob", "address": "bob@example.com"}}],
    "bccRecipients": [],
    "replyTo": [],
    "receivedDateTime": "2026-04-13T10:00:00Z",
    "sentDateTime": "2026-04-13T09:59:00Z",
    "body": {"contentType": "html", "content": "<html><body><p>Hello</p><br><p>World</p></body></html>"},
    "hasAttachments": True,
    "importance": "normal",
    "isRead": True,
    "conversationId": "conv1",
    "flag": {"flagStatus": "notFlagged"},
    "attachments": [
        {"id": "att1", "name": "report.pdf", "contentType": "application/pdf", "size": 12345, "isInline": False},
    ],
}


class TestHtmlToText:
    def test_br_tags(self):
        assert "line1\nline2" in mod._html_to_text("line1<br>line2")
        assert "line1\nline2" in mod._html_to_text("line1<br/>line2")
        assert "line1\nline2" in mod._html_to_text("line1<BR>line2")

    def test_block_tags(self):
        result = mod._html_to_text("<p>para1</p><p>para2</p>")
        assert "para1" in result
        assert "para2" in result

    def test_strip_tags(self):
        assert mod._html_to_text("<b>bold</b>") == "bold"
        assert mod._html_to_text('<a href="url">link</a>') == "link"

    def test_html_entities(self):
        assert "&" in mod._html_to_text("&amp;")
        assert "<" in mod._html_to_text("&lt;")

    def test_empty_input(self):
        assert mod._html_to_text("") == ""
        assert mod._html_to_text(None) == ""


class TestReadMessage:
    @responses.activate
    def test_read_message_text_format(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json=SAMPLE_FULL_MESSAGE,
            status=200,
        )
        result = mod.read_message("token", "msg1", fmt="text")
        assert result["subject"] == "Hello"
        assert result["from"]["name"] == "Jane"
        assert result["bodyFormat"] == "text"
        assert "<html>" not in result["body"]
        assert "Hello" in result["body"]
        assert "World" in result["body"]
        assert len(result["attachments"]) == 1
        assert result["attachments"][0]["name"] == "report.pdf"

    @responses.activate
    def test_read_message_html_format(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json=SAMPLE_FULL_MESSAGE,
            status=200,
        )
        result = mod.read_message("token", "msg1", fmt="html")
        assert result["bodyFormat"] == "html"
        assert "<html>" in result["body"]

    @responses.activate
    def test_read_message_cc_recipients(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json=SAMPLE_FULL_MESSAGE,
            status=200,
        )
        result = mod.read_message("token", "msg1")
        assert len(result["cc"]) == 1
        assert result["cc"][0]["name"] == "Bob"

    @responses.activate
    def test_read_message_flag(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json=SAMPLE_FULL_MESSAGE,
            status=200,
        )
        result = mod.read_message("token", "msg1")
        assert result["flag"] == "notFlagged"
