#!/usr/bin/env python3
"""Send a text message via Telegram Bot API."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from telegram_client import TelegramClient, TelegramError, error_response


def send_message(
    client: TelegramClient,
    chat_id: str,
    text: str,
    parse_mode: str | None = None,
    reply_to: int | None = None,
    silent: bool = False,
) -> dict:
    """Send a text message to a Telegram chat."""
    params: dict = {
        "chat_id": chat_id,
        "text": text,
    }
    if parse_mode:
        params["parse_mode"] = parse_mode
    if reply_to:
        params["reply_to_message_id"] = reply_to
    if silent:
        params["disable_notification"] = True

    result = client.api_call("sendMessage", params)

    return {
        "success": True,
        "message_id": result["message_id"],
        "chat_id": result["chat"]["id"],
    }


def main():
    parser = argparse.ArgumentParser(description="Send a Telegram message")
    parser.add_argument("--token", help="Bot token (or set SIG_TELEGRAM_TOKEN)")
    parser.add_argument("--chat-id", required=True, help="Target chat ID")
    parser.add_argument("--text", required=True, help="Message text")
    parser.add_argument("--parse-mode", choices=["html", "markdown"], help="Parse mode")
    parser.add_argument("--reply-to", type=int, help="Reply to message ID")
    parser.add_argument("--silent", action="store_true", help="Send without notification")
    args = parser.parse_args()

    try:
        client = TelegramClient.create(args.token)
        result = send_message(client, args.chat_id, args.text, args.parse_mode, args.reply_to, args.silent)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except TelegramError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump(error_response("HTTP_" + str(e.response.status_code), str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
