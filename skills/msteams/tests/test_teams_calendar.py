"""Tests for msteams/scripts/teams_calendar.py"""

import re
from datetime import datetime, timezone
from unittest.mock import patch

import responses

from test_helpers import load_script

mod = load_script("msteams", "teams_calendar")

FIXED_NOW = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)


class TestGetCalendar:
    @responses.activate
    @patch.object(mod, "datetime", wraps=datetime)
    def test_today_range(self, mock_dt):
        mock_dt.now.return_value = FIXED_NOW
        responses.get(
            url=re.compile(r"https?://.*"),
            json={
                "value": [
                    {
                        "subject": "Standup",
                        "start": {"dateTime": "2024-06-15T09:00:00"},
                        "end": {"dateTime": "2024-06-15T09:30:00"},
                        "organizer": {"emailAddress": {"name": "Alice"}},
                        "location": {"displayName": "Room 1"},
                        "isOnlineMeeting": True,
                        "onlineMeeting": {"joinUrl": "https://teams.example.com/join"},
                        "attendees": [{"emailAddress": {"address": "a@example.com"}}],
                    },
                ]
            },
            status=200,
        )
        result = mod.get_calendar("token", range_type="today")
        assert result["count"] == 1
        e = result["events"][0]
        assert e["subject"] == "Standup"
        assert e["organizer"] == "Alice"
        assert e["isOnline"] is True
        assert e["attendees"] == 1

    @responses.activate
    def test_custom_range(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={"value": []},
            status=200,
        )
        result = mod.get_calendar("token", start="2024-01-01", end="2024-01-07")
        assert result["count"] == 0
        assert result["events"] == []

    @responses.activate
    def test_custom_range_iso(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={"value": []},
            status=200,
        )
        result = mod.get_calendar("token", start="2024-01-01T00:00:00Z", end="2024-01-07T00:00:00Z")
        assert result["count"] == 0
