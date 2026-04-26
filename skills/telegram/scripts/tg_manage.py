#!/usr/bin/env python3
"""Delete, pin, or unpin messages via Telegram Bot API."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from telegram_client import TelegramClient, TelegramError, error_response

ACTION_METHODS = {
    "delete": "deleteMessage",
    "pin": "pinChatMessage",
    "unpin": "unpinChatMessage",
}


def manage_message(
    client: TelegramClient,
    chat_id: str,
    message_id: int,
    action: str,
) -> dict:
    """Perform delete, pin, or unpin on a message."""
    method = ACTION_METHODS.get(action)
    if not method:
        raise ValueError(f"Invalid action: {action}. Use delete, pin, or unpin.")

    params: dict = {
        "chat_id": chat_id,
        "message_id": message_id,
    }

    client.api_call(method, params)

    return {
        "success": True,
        "action": action,
        "message_id": message_id,
    }


def main():
    parser = argparse.ArgumentParser(description="Delete/pin/unpin a Telegram message")
    parser.add_argument("--token", help="Bot token (or set SIG_TELEGRAM_TOKEN)")
    parser.add_argument("--chat-id", required=True, help="Chat ID")
    parser.add_argument("--message-id", type=int, required=True, help="Message ID")
    parser.add_argument("--action", required=True, choices=["delete", "pin", "unpin"], help="Action to perform")
    args = parser.parse_args()

    try:
        client = TelegramClient.create(args.token)
        result = manage_message(client, args.chat_id, args.message_id, args.action)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except TelegramError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump(error_response("HTTP_" + str(e.response.status_code), str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
