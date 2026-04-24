"""Tests for telegram/scripts/tg_messages.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("telegram", "tg_messages")
client_mod = load_script("telegram", "telegram_client")

FAKE_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"

SAMPLE_UPDATE = {
    "update_id": 100,
    "message": {
        "message_id": 1,
        "date": 1700000000,
        "text": "Hello",
        "from": {"id": 42, "is_bot": False, "first_name": "John"},
        "chat": {"id": 123, "type": "private"},
    },
}


class TestGetMessages:
    @responses.activate
    def test_get_messages_success(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/getUpdates"),
            json={"ok": True, "result": [SAMPLE_UPDATE]},
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.get_messages(client, limit=10)
        assert result["count"] == 1
        assert result["last_update_id"] == 100
        assert result["messages"][0]["text"] == "Hello"

    @responses.activate
    def test_get_messages_empty(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/getUpdates"),
            json={"ok": True, "result": []},
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.get_messages(client, limit=10)
        assert result["count"] == 0
        assert result["messages"] == []
        assert "last_update_id" not in result

    @responses.activate
    def test_get_messages_with_offset(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/getUpdates"),
            json={"ok": True, "result": [SAMPLE_UPDATE]},
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.get_messages(client, limit=10, offset=99)
        assert result["count"] == 1

    @responses.activate
    def test_get_messages_edited(self):
        update = {
            "update_id": 101,
            "edited_message": {
                "message_id": 2,
                "date": 1700000001,
                "text": "Edited",
                "from": {"id": 42, "is_bot": False, "first_name": "John"},
                "chat": {"id": 123, "type": "private"},
            },
        }
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/getUpdates"),
            json={"ok": True, "result": [update]},
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.get_messages(client, limit=10)
        assert result["count"] == 1
        assert result["messages"][0]["text"] == "Edited"
