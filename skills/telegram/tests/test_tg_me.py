"""Tests for telegram/scripts/tg_me.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("telegram", "tg_me")
client_mod = load_script("telegram", "telegram_client")

FAKE_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"


class TestGetMe:
    @responses.activate
    def test_get_me_success(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/getMe"),
            json={
                "ok": True,
                "result": {
                    "id": 123456789,
                    "is_bot": True,
                    "first_name": "TestBot",
                    "username": "test_bot",
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.get_me(client)
        assert result["bot"]["id"] == 123456789
        assert result["bot"]["is_bot"] is True
        assert result["bot"]["first_name"] == "TestBot"
        assert result["bot"]["username"] == "test_bot"
