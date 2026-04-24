#!/usr/bin/env python3
"""Get chat info via Telegram Bot API."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from telegram_client import TelegramClient, TelegramError, error_response, parse_chat


def get_chat(client: TelegramClient, chat_id: str) -> dict:
    """Fetch chat information."""
    result = client.api_call("getChat", {"chat_id": chat_id})
    return {"chat": parse_chat(result)}


def main():
    parser = argparse.ArgumentParser(description="Get Telegram chat info")
    parser.add_argument("--token", help="Bot token (or set SIG_TELEGRAM_TOKEN)")
    parser.add_argument("--chat-id", required=True, help="Chat ID")
    args = parser.parse_args()

    try:
        client = TelegramClient.create(args.token)
        result = get_chat(client, args.chat_id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except TelegramError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump(error_response("HTTP_" + str(e.response.status_code), str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
