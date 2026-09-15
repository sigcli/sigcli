"""Tests for telegram/scripts/tg_poll.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("telegram", "tg_poll")
client_mod = load_script("telegram", "telegram_client")

FAKE_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"


class TestSendPoll:
    @responses.activate
    def test_send_poll_success(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/sendPoll"),
            json={
                "ok": True,
                "result": {
                    "message_id": 50,
                    "date": 1700000000,
                    "chat": {"id": 123, "type": "group"},
                    "poll": {
                        "id": "poll_abc123",
                        "question": "Favorite color?",
                        "options": [
                            {"text": "Red", "voter_count": 0},
                            {"text": "Blue", "voter_count": 0},
                        ],
                        "is_anonymous": False,
                        "type": "regular",
                    },
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.send_poll(client, "123", "Favorite color?", ["Red", "Blue"])
        assert result["success"] is True
        assert result["message_id"] == 50
        assert result["poll_id"] == "poll_abc123"

    @responses.activate
    def test_send_poll_anonymous(self):
        responses.post(
            url=re.compile(r"https://api\.telegram\.org/bot.+/sendPoll"),
            json={
                "ok": True,
                "result": {
                    "message_id": 51,
                    "date": 1700000000,
                    "chat": {"id": 123, "type": "group"},
                    "poll": {
                        "id": "poll_def456",
                        "question": "Best language?",
                        "options": [
                            {"text": "Python", "voter_count": 0},
                            {"text": "Rust", "voter_count": 0},
                            {"text": "Go", "voter_count": 0},
                        ],
                        "is_anonymous": True,
                        "type": "regular",
                    },
                },
            },
            status=200,
        )
        client = client_mod.TelegramClient(FAKE_TOKEN)
        result = mod.send_poll(client, "123", "Best language?", ["Python", "Rust", "Go"], anonymous=True)
        assert result["success"] is True
        assert result["poll_id"] == "poll_def456"
