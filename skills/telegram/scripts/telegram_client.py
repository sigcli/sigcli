#!/usr/bin/env python3
"""Shared Telegram Bot API client for Telegram skill scripts.

Handles bot token extraction, HTTP transport, error handling,
and response normalization for the Telegram Bot API.
"""

from __future__ import annotations

import os

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TELEGRAM_API_BASE = "https://api.telegram.org"
TIMEOUT = 30

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class TelegramError(Exception):
    """Raised when the Telegram Bot API returns ok=false."""

    def __init__(self, code: str, message: str = ""):
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def error_response(code: str, message: str) -> dict:
    """Build a standard error dict for JSON output."""
    return {"error": code, "message": message}


# ---------------------------------------------------------------------------
# Token extraction
# ---------------------------------------------------------------------------


def get_bot_token(token_arg: str | None = None) -> str:
    """Retrieve the Telegram bot token.

    Checks the --token argument first, then SIG_TELEGRAM_TOKEN env var.

    Returns:
        Bot token string.

    Raises:
        RuntimeError: If no token is available.
    """
    token = token_arg or os.environ.get("SIG_TELEGRAM_TOKEN", "")
    if not token:
        raise RuntimeError(
            "No Telegram bot token provided. "
            "Pass --token or set SIG_TELEGRAM_TOKEN via 'sig run telegram --'."
        )
    return token


# ---------------------------------------------------------------------------
# Telegram Bot API client
# ---------------------------------------------------------------------------


class TelegramClient:
    """Thin HTTP client for the Telegram Bot API.

    All requests go to https://api.telegram.org/bot{token}/{method}.
    """

    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.base_url = f"{TELEGRAM_API_BASE}/bot{bot_token}/"
        self._session = requests.Session()

    @classmethod
    def create(cls, token_arg: str | None = None) -> TelegramClient:
        """Create a client by extracting the bot token."""
        token = get_bot_token(token_arg)
        return cls(token)

    def api_call(self, method: str, params: dict | None = None) -> dict:
        """POST to the Telegram Bot API.

        Returns:
            The ``result`` field from the API response.

        Raises:
            TelegramError: If the API returns ``ok: false``.
            requests.HTTPError: On HTTP-level errors.
        """
        url = f"{self.base_url}{method}"
        resp = self._session.post(url, json=params or {}, timeout=TIMEOUT)

        # Let requests handle HTTP errors for non-JSON responses
        if resp.status_code >= 500:
            resp.raise_for_status()

        data = resp.json()

        if not data.get("ok"):
            error_code = str(data.get("error_code", resp.status_code))
            description = data.get("description", "Telegram API returned ok=false")
            raise TelegramError(error_code, description)

        return data.get("result", {})


# ---------------------------------------------------------------------------
# Response parsers
# ---------------------------------------------------------------------------


def parse_user(user: dict) -> dict:
    """Normalize a Telegram User object."""
    return {
        "id": user.get("id"),
        "is_bot": user.get("is_bot", False),
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
        "username": user.get("username", ""),
        "language_code": user.get("language_code", ""),
    }


def parse_chat(chat: dict) -> dict:
    """Normalize a Telegram Chat object."""
    return {
        "id": chat.get("id"),
        "type": chat.get("type", ""),
        "title": chat.get("title", ""),
        "username": chat.get("username", ""),
        "first_name": chat.get("first_name", ""),
        "description": chat.get("description", ""),
    }


def parse_message(msg: dict) -> dict:
    """Normalize a Telegram Message object."""
    result = {
        "message_id": msg.get("message_id"),
        "date": msg.get("date"),
        "text": msg.get("text", ""),
        "caption": msg.get("caption", ""),
    }
    if msg.get("from"):
        result["from"] = parse_user(msg["from"])
    if msg.get("chat"):
        result["chat"] = parse_chat(msg["chat"])
    if msg.get("reply_to_message"):
        result["reply_to_message_id"] = msg["reply_to_message"]["message_id"]
    if msg.get("forward_from"):
        result["forward_from"] = parse_user(msg["forward_from"])
    return result
