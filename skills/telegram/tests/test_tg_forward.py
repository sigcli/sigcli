"""Tests for telegram/scripts/tg_forward.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("telegram", "tg_forward")
client_mod = load_script("telegram", "telegram_client")

FAKE_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"


class TestForwardMessage:
    @responses.activate
    def test_forward_success(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/forwardMessage"),
            json={
                "ok": True,
                "result": {
                    "message_id": 99,
                    "date": 1700000000,
                    "chat": {"id": 123, "type": "private"},
                    "forward_from": {"id": 42, "is_bot": False, "first_name": "John"},
                    "text": "Forwarded",
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.forward_message(client, "123", "456", 10)
        assert result["success"] is True
        assert result["message_id"] == 99

    @responses.activate
    def test_forward_silent(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/forwardMessage"),
            json={
                "ok": True,
                "result": {
                    "message_id": 100,
                    "date": 1700000000,
                    "chat": {"id": 123, "type": "private"},
                    "text": "Forwarded quietly",
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.forward_message(client, "123", "456", 10, silent=True)
        assert result["success"] is True
        assert result["message_id"] == 100
