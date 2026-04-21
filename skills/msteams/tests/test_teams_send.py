"""Tests for msteams/scripts/teams_send.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("msteams", "teams_send")


class TestSendMessage:
    @responses.activate
    def test_send_new_message(self):
        responses.post(
            url=re.compile(r"https?://.*"),
            json={"id": "msg123"},
            status=201,
        )
        result = mod.send_message("token", "19:abc@thread.v2", "Hello!")
        assert result["success"] is True
        assert result["messageId"] == "msg123"
        assert result["isReply"] is False

    @responses.activate
    def test_send_reply(self):
        responses.post(
            url=re.compile(r"https?://.*"),
            json={"id": "reply456"},
            status=201,
        )
        result = mod.send_message("token", "19:abc@thread.v2", "Reply!", parent_message_id="msg123")
        assert result["success"] is True
        assert result["isReply"] is True

    @responses.activate
    def test_html_format(self):
        responses.post(
            url=re.compile(r"https?://.*"),
            json={"id": "msg789"},
            status=201,
        )
        result = mod.send_message("token", "conv1", "<b>Bold</b>", fmt="html")
        assert result["success"] is True
        # Verify the request body used RichText/Html
        body = responses.calls[0].request.body
        if isinstance(body, bytes):
            body = body.decode()
        assert "RichText/Html" in body

    @responses.activate
    def test_markdown_format(self):
        responses.post(
            url=re.compile(r"https?://.*"),
            json={"id": "msg789"},
            status=201,
        )
        result = mod.send_message("token", "conv1", "**Bold**", fmt="markdown")
        assert result["success"] is True
        body = responses.calls[0].request.body
        if isinstance(body, bytes):
            body = body.decode()
        assert "Text" in body
