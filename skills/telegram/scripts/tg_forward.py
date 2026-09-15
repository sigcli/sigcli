#!/usr/bin/env python3
"""Forward a message via Telegram Bot API."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from telegram_client import TelegramClient, TelegramError, error_response


def forward_message(
    client: TelegramClient,
    chat_id: str,
    from_chat_id: str,
    message_id: int,
    silent: bool = False,
) -> dict:
    """Forward a message from one chat to another."""
    params: dict = {
        "chat_id": chat_id,
        "from_chat_id": from_chat_id,
        "message_id": message_id,
    }
    if silent:
        params["disable_notification"] = True

    result = client.api_call("forwardMessage", params)

    return {
        "success": True,
        "message_id": result["message_id"],
    }


def main():
    parser = argparse.ArgumentParser(description="Forward a Telegram message")
    parser.add_argument("--token", help="Bot token (or set SIG_TELEGRAM_TOKEN)")
    parser.add_argument("--chat-id", required=True, help="Destination chat ID")
    parser.add_argument("--from-chat-id", required=True, help="Source chat ID")
    parser.add_argument("--message-id", type=int, required=True, help="Message ID to forward")
    parser.add_argument("--silent", action="store_true", help="Forward without notification")
    args = parser.parse_args()

    try:
        client = TelegramClient.create(args.token)
        result = forward_message(client, args.chat_id, args.from_chat_id, args.message_id, args.silent)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except TelegramError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump(error_response("HTTP_" + str(e.response.status_code), str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
