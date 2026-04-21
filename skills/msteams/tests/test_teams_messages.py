"""Tests for msteams/scripts/teams_messages.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("msteams", "teams_messages")


class TestStripHtml:
    def test_basic(self):
        assert mod._strip_html("<b>bold</b>") == "bold"

    def test_none(self):
        assert mod._strip_html(None) == ""


class TestGetMessages:
    @responses.activate
    def test_success(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={
                "messages": [
                    {
                        "id": "msg1",
                        "composetime": "2024-01-15T10:00:00Z",
                        "imdisplayname": "John",
                        "content": "<p>Hello</p>",
                        "messagetype": "RichText/Html",
                    },
                    {
                        "id": "msg2",
                        "composetime": "2024-01-15T10:01:00Z",
                        "imdisplayname": "",
                        "content": "System message",
                        "messagetype": "ThreadActivity/AddMember",
                    },
                ]
            },
            status=200,
        )
        result = mod.get_messages("token", "19:abc@thread.v2")
        assert result["count"] == 1  # system message filtered
        assert result["messages"][0]["sender"] == "John"
        assert result["messages"][0]["content"] == "Hello"

    @responses.activate
    def test_search_filter(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={
                "messages": [
                    {
                        "id": "1",
                        "composetime": "2024-01-15T10:00:00Z",
                        "imdisplayname": "A",
                        "content": "deploy the app",
                        "messagetype": "Text",
                    },
                    {
                        "id": "2",
                        "composetime": "2024-01-15T10:01:00Z",
                        "imdisplayname": "B",
                        "content": "sure thing",
                        "messagetype": "Text",
                    },
                ]
            },
            status=200,
        )
        result = mod.get_messages("token", "conv1", search="deploy")
        assert result["count"] == 1
        assert result["messages"][0]["id"] == "1"

    @responses.activate
    def test_limit(self):
        messages = [
            {
                "id": str(i),
                "composetime": f"2024-01-15T{10 + i}:00:00Z",
                "imdisplayname": "A",
                "content": f"msg {i}",
                "messagetype": "Text",
            }
            for i in range(10)
        ]
        responses.get(
            url=re.compile(r"https?://.*"),
            json={"messages": messages},
            status=200,
        )
        result = mod.get_messages("token", "conv1", limit=3)
        assert result["count"] == 3
