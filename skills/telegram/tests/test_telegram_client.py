"""Tests for telegram/scripts/telegram_client.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("telegram", "telegram_client")

FAKE_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"


class TestTelegramClient:
    def test_base_url_construction(self):
        client = mod.TelegramClient(FAKE_TOKEN)
        assert client.base_url == f"https://api.telegram.org/bot{FAKE_TOKEN}/"

    @responses.activate
    def test_api_call_success(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/getMe"),
            json={"ok": True, "result": {"id": 123, "is_bot": True, "first_name": "TestBot"}},
            status=200,
        )
        client = mod.TelegramClient(FAKE_TOKEN)
        result = client.api_call("getMe")
        assert result["id"] == 123
        assert result["is_bot"] is True

    @responses.activate
    def test_api_call_error(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/sendMessage"),
            json={"ok": False, "error_code": 400, "description": "Bad Request: chat not found"},
            status=400,
        )
        client = mod.TelegramClient(FAKE_TOKEN)
        try:
            client.api_call("sendMessage", {"chat_id": "invalid", "text": "hi"})
            assert False, "Should have raised TelegramError"
        except mod.TelegramError as e:
            assert e.code == "400"
            assert "chat not found" in e.message


class TestGetBotToken:
    def test_token_from_arg(self):
        token = mod.get_bot_token("my-token")
        assert token == "my-token"

    def test_token_from_env(self, monkeypatch):
        monkeypatch.setenv("SIG_TELEGRAM_TOKEN", "env-token")
        token = mod.get_bot_token(None)
        assert token == "env-token"

    def test_no_token_raises(self, monkeypatch):
        monkeypatch.delenv("SIG_TELEGRAM_TOKEN", raising=False)
        try:
            mod.get_bot_token(None)
            assert False, "Should have raised RuntimeError"
        except RuntimeError as e:
            assert "No Telegram bot token" in str(e)


class TestParsers:
    def test_parse_user(self):
        user = mod.parse_user({
            "id": 42,
            "is_bot": False,
            "first_name": "John",
            "last_name": "Doe",
            "username": "johndoe",
            "language_code": "en",
        })
        assert user["id"] == 42
        assert user["first_name"] == "John"
        assert user["username"] == "johndoe"

    def test_parse_chat(self):
        chat = mod.parse_chat({
            "id": -1001234567890,
            "type": "supergroup",
            "title": "Test Group",
            "username": "testgroup",
        })
        assert chat["id"] == -1001234567890
        assert chat["type"] == "supergroup"
        assert chat["title"] == "Test Group"

    def test_parse_message(self):
        msg = mod.parse_message({
            "message_id": 100,
            "date": 1700000000,
            "text": "Hello world",
            "from": {"id": 42, "is_bot": False, "first_name": "John"},
            "chat": {"id": 123, "type": "private"},
        })
        assert msg["message_id"] == 100
        assert msg["text"] == "Hello world"
        assert msg["from"]["id"] == 42
        assert msg["chat"]["id"] == 123

    def test_parse_message_minimal(self):
        msg = mod.parse_message({"message_id": 1, "date": 0})
        assert msg["message_id"] == 1
        assert msg["text"] == ""
        assert "from" not in msg
