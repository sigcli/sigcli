"""Tests for telegram/scripts/tg_chat.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("telegram", "tg_chat")
client_mod = load_script("telegram", "telegram_client")

FAKE_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"


class TestGetChat:
    @responses.activate
    def test_get_chat_success(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/getChat"),
            json={
                "ok": True,
                "result": {
                    "id": -1001234567890,
                    "type": "supergroup",
                    "title": "Test Group",
                    "username": "testgroup",
                    "description": "A test group",
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.get_chat(client, "-1001234567890")
        assert result["chat"]["id"] == -1001234567890
        assert result["chat"]["type"] == "supergroup"
        assert result["chat"]["title"] == "Test Group"
        assert result["chat"]["description"] == "A test group"

    @responses.activate
    def test_get_chat_private(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/getChat"),
            json={
                "ok": True,
                "result": {
                    "id": 42,
                    "type": "private",
                    "first_name": "John",
                    "username": "johndoe",
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.get_chat(client, "42")
        assert result["chat"]["id"] == 42
        assert result["chat"]["type"] == "private"
        assert result["chat"]["first_name"] == "John"
