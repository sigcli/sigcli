"""Tests for msteams/scripts/teams_chat.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("msteams", "teams_chat")


class TestFindPrivateChat:
    @responses.activate
    def test_no_user_found(self):
        # People search returns empty
        responses.get(
            url=re.compile(r"https?://.*"),
            json={"value": []},
            status=200,
        )
        result = mod.find_private_chat("chat_token", "graph_token", "nonexistent")
        assert result["error"] == "NOT_FOUND"

    @responses.activate
    def test_multiple_candidates(self):
        # People search returns multiple
        responses.get(
            url=re.compile(r"https?://.*"),
            json={
                "value": [
                    {
                        "id": "aaa11111-bbbb-cccc-dddd-eeeeeeeeeeee",
                        "displayName": "John Smith",
                        "scoredEmailAddresses": [{"address": "j1@example.com"}],
                    },
                    {
                        "id": "ccc22222-dddd-eeee-ffff-111111111111",
                        "displayName": "John Doe",
                        "scoredEmailAddresses": [{"address": "j2@example.com"}],
                    },
                ]
            },
            status=200,
        )
        # My user ID
        responses.get(
            url=re.compile(r"https?://.*"),
            json={"id": "xxx33333-yyyy-zzzz-aaaa-bbbbbbbbbbbb"},
            status=200,
        )
        result = mod.find_private_chat("chat_token", "graph_token", "John")
        assert result["found"] is False
        assert "candidates" in result


class TestCreateGroupChat:
    @responses.activate
    def test_success(self):
        # Get my user ID
        responses.get(
            url=re.compile(r"https?://.*"),
            json={"id": "my-guid"},
            status=200,
        )
        # Create thread
        responses.post(
            url=re.compile(r"https?://.*"),
            json={"id": "19:new-thread@thread.v2"},
            status=201,
        )
        result = mod.create_group_chat("chat_token", "graph_token", ["user1-guid", "user2-guid"], topic="Test Group")
        assert result["success"] is True
        assert result["conversationId"] == "19:new-thread@thread.v2"
