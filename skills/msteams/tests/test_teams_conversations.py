"""Tests for msteams/scripts/teams_conversations.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("msteams", "teams_conversations")


class TestStripHtml:
    def test_basic(self):
        assert mod._strip_html("<b>bold</b> text") == "bold text"

    def test_nested(self):
        assert mod._strip_html("<div><p>hello</p></div>") == "hello"

    def test_none(self):
        assert mod._strip_html(None) == ""

    def test_empty(self):
        assert mod._strip_html("") == ""

    def test_no_tags(self):
        assert mod._strip_html("plain text") == "plain text"


class TestListConversations:
    @responses.activate
    def test_success(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={
                "conversations": [
                    {
                        "id": "19:abc@thread.v2",
                        "conversationType": "chat",
                        "threadProperties": {"topic": "Test Chat"},
                        "lastMessage": {
                            "content": "<p>Hello world</p>",
                            "composetime": "2024-01-15T10:00:00Z",
                            "imdisplayname": "John Doe",
                        },
                    },
                ]
            },
            status=200,
        )
        result = mod.list_conversations("fake_token")
        assert result["count"] == 1
        c = result["conversations"][0]
        assert c["id"] == "19:abc@thread.v2"
        assert c["topic"] == "Test Chat"
        assert c["lastMessage"] == "Hello world"  # HTML stripped

    @responses.activate
    def test_search_filter(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={
                "conversations": [
                    {
                        "id": "1",
                        "conversationType": "chat",
                        "threadProperties": {"topic": "Project Alpha"},
                        "lastMessage": {
                            "content": "update",
                            "composetime": "2024-01-15T10:00:00Z",
                            "imdisplayname": "A",
                        },
                    },
                    {
                        "id": "2",
                        "conversationType": "chat",
                        "threadProperties": {"topic": "Random"},
                        "lastMessage": {"content": "hey", "composetime": "2024-01-15T10:00:00Z", "imdisplayname": "B"},
                    },
                ]
            },
            status=200,
        )
        result = mod.list_conversations("fake_token", search="Alpha")
        assert result["count"] == 1
        assert result["conversations"][0]["id"] == "1"

    @responses.activate
    def test_time_filter(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={
                "conversations": [
                    {
                        "id": "old",
                        "conversationType": "chat",
                        "threadProperties": {"topic": "Old"},
                        "lastMessage": {
                            "content": "old msg",
                            "composetime": "2023-01-01T00:00:00Z",
                            "imdisplayname": "A",
                        },
                    },
                    {
                        "id": "new",
                        "conversationType": "chat",
                        "threadProperties": {"topic": "New"},
                        "lastMessage": {
                            "content": "new msg",
                            "composetime": "2024-06-01T00:00:00Z",
                            "imdisplayname": "B",
                        },
                    },
                ]
            },
            status=200,
        )
        result = mod.list_conversations("fake_token", since="2024-01-01T00:00:00Z")
        assert result["count"] == 1
        assert result["conversations"][0]["id"] == "new"

    @responses.activate
    def test_limit(self):
        conversations = [
            {
                "id": str(i),
                "conversationType": "chat",
                "threadProperties": {"topic": f"Chat {i}"},
                "lastMessage": {"content": "msg", "composetime": "2024-01-15T10:00:00Z", "imdisplayname": "A"},
            }
            for i in range(10)
        ]
        responses.get(
            url=re.compile(r"https?://.*"),
            json={"conversations": conversations},
            status=200,
        )
        result = mod.list_conversations("fake_token", limit=3)
        assert result["count"] == 3
