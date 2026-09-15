"""Tests for telegram/scripts/tg_send.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("telegram", "tg_send")
client_mod = load_script("telegram", "telegram_client")

FAKE_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"


class TestSendMessage:
    @responses.activate
    def test_send_basic(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/sendMessage"),
            json={
                "ok": True,
                "result": {
                    "message_id": 42,
                    "chat": {"id": 123, "type": "private"},
                    "date": 1700000000,
                    "text": "Hello",
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.send_message(client, "123", "Hello")
        assert result["success"] is True
        assert result["message_id"] == 42
        assert result["chat_id"] == 123

    @responses.activate
    def test_send_with_parse_mode(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/sendMessage"),
            json={
                "ok": True,
                "result": {
                    "message_id": 43,
                    "chat": {"id": 123, "type": "private"},
                    "date": 1700000000,
                    "text": "Bold",
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.send_message(client, "123", "<b>Bold</b>", parse_mode="html")
        assert result["success"] is True
        assert result["message_id"] == 43

    @responses.activate
    def test_send_with_reply(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/sendMessage"),
            json={
                "ok": True,
                "result": {
                    "message_id": 44,
                    "chat": {"id": 123, "type": "private"},
                    "date": 1700000000,
                    "text": "Reply",
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.send_message(client, "123", "Reply", reply_to=10)
        assert result["success"] is True
        assert result["message_id"] == 44

    @responses.activate
    def test_send_silent(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/sendMessage"),
            json={
                "ok": True,
                "result": {
                    "message_id": 45,
                    "chat": {"id": 123, "type": "private"},
                    "date": 1700000000,
                    "text": "Quiet",
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.send_message(client, "123", "Quiet", silent=True)
        assert result["success"] is True
