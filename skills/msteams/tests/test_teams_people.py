"""Tests for msteams/scripts/teams_people.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("msteams", "teams_people")


class TestFormatUser:
    def test_full_user(self):
        user = {
            "id": "abc-123",
            "displayName": "John Doe",
            "scoredEmailAddresses": [{"address": "john@example.com"}],
            "phones": [{"number": "+1234567890"}],
            "department": "Engineering",
            "jobTitle": "Developer",
            "officeLocation": "Building 1",
            "mailNickname": "I12345",
            "city": "Berlin",
            "country": "Germany",
        }
        result = mod._format_user(user)
        assert result["id"] == "abc-123"
        assert result["name"] == "John Doe"
        assert result["email"] == "john@example.com"
        assert result["phone"] == "+1234567890"
        assert result["department"] == "Engineering"
        assert result["iNumber"] == "I12345"

    def test_minimal_user(self):
        user = {"id": "xyz", "displayName": "Jane"}
        result = mod._format_user(user)
        assert result["name"] == "Jane"
        assert result["email"] == ""
        assert result["phone"] == ""

    def test_mail_fallback(self):
        user = {"id": "1", "displayName": "A", "mail": "fallback@example.com"}
        result = mod._format_user(user)
        assert result["email"] == "fallback@example.com"

    def test_phone_string_list(self):
        user = {"id": "1", "displayName": "A", "phones": ["+111"], "businessPhones": []}
        result = mod._format_user(user)
        assert result["phone"] == "+111"

    def test_phone_dict_list(self):
        user = {"id": "1", "displayName": "A", "phones": [{"number": "+222"}]}
        result = mod._format_user(user)
        assert result["phone"] == "+222"

    def test_business_phones_fallback(self):
        user = {"id": "1", "displayName": "A", "businessPhones": ["+333"]}
        result = mod._format_user(user)
        assert result["phone"] == "+333"


class TestSearchPeople:
    @responses.activate
    def test_success(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={
                "value": [
                    {"id": "a1", "displayName": "Alice", "scoredEmailAddresses": [{"address": "alice@example.com"}]},
                    {"id": "b2", "displayName": "Bob", "scoredEmailAddresses": [{"address": "bob@example.com"}]},
                    {"id": "c3", "displayName": "Charlie", "scoredEmailAddresses": [{"address": "charlie@example.com"}]},
                ]
            },
            status=200,
        )
        result = mod.search_people("token", "test")
        assert result["count"] == 3
        assert result["results"][0]["name"] == "Alice"


class TestGetManager:
    @responses.activate
    def test_success(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={"id": "mgr1", "displayName": "Manager"},
            status=200,
        )
        result = mod.get_manager("token")
        assert result["manager"]["name"] == "Manager"

    @responses.activate
    def test_no_manager(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            status=404,
        )
        result = mod.get_manager("token")
        assert result["manager"] is None


class TestGetProfile:
    @responses.activate
    def test_success(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={"id": "me1", "displayName": "My Name", "mail": "me@example.com"},
            status=200,
        )
        result = mod.get_profile("token")
        assert result["profile"]["name"] == "My Name"
