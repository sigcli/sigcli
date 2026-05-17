"""Tests for telegram/scripts/tg_manage.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("telegram", "tg_manage")
client_mod = load_script("telegram", "telegram_client")

FAKE_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"


class TestManageMessage:
    @responses.activate
    def test_delete_message(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/deleteMessage"),
            json={"ok": True, "result": True},
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.manage_message(client, "123", 42, "delete")
        assert result["success"] is True
        assert result["action"] == "delete"
        assert result["message_id"] == 42

    @responses.activate
    def test_pin_message(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/pinChatMessage"),
            json={"ok": True, "result": True},
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.manage_message(client, "123", 42, "pin")
        assert result["success"] is True
        assert result["action"] == "pin"
        assert result["message_id"] == 42

    @responses.activate
    def test_unpin_message(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/unpinChatMessage"),
            json={"ok": True, "result": True},
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.manage_message(client, "123", 42, "unpin")
        assert result["success"] is True
        assert result["action"] == "unpin"
        assert result["message_id"] == 42

    def test_invalid_action(self):
        client = client_mod.TelegramClient(FAKE_TOKEN)
        try:
            mod.manage_message(client, "123", 42, "invalid")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Invalid action" in str(e)
