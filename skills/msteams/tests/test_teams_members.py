"""Tests for msteams/scripts/teams_members.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("msteams", "teams_members")


class TestExtractGuid:
    def test_orgid_format(self):
        assert mod._extract_guid("8:orgid:abc-def-123-456-789") == "abc-def-123-456-789"

    def test_plain_guid(self):
        # Falls back to splitting on ":"
        assert mod._extract_guid("abc-def") == "abc-def"

    def test_other_prefix(self):
        assert mod._extract_guid("8:skype:user@example.com") == "user@example.com"


class TestGetMembers:
    @responses.activate
    def test_success(self):
        # Thread members
        responses.get(
            url=re.compile(r"https?://.*"),
            json={
                "members": [
                    {"id": "8:orgid:aaa-bbb-ccc", "role": "Admin"},
                    {"id": "8:orgid:ddd-eee-fff", "role": "User"},
                ]
            },
            status=200,
        )
        # Graph name resolution (2 calls)
        responses.get(url=re.compile(r"https?://.*"), json={"displayName": "Alice"}, status=200)
        responses.get(url=re.compile(r"https?://.*"), json={"displayName": "Bob"}, status=200)

        result = mod.get_members("chat_token", "graph_token", "19:abc@thread.v2")
        assert result["count"] == 2
        assert result["members"][0]["name"] == "Alice"
        assert result["members"][0]["role"] == "Admin"
        assert result["members"][1]["name"] == "Bob"

    @responses.activate
    def test_without_graph_token(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={"members": [{"id": "8:orgid:aaa-bbb-ccc", "role": "User"}]},
            status=200,
        )
        result = mod.get_members("chat_token", None, "conv1")
        assert result["count"] == 1
        # Without graph token, name falls back to GUID
        assert result["members"][0]["id"] == "aaa-bbb-ccc"
