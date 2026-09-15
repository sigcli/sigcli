#!/usr/bin/env python3
"""Send a poll via Telegram Bot API."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from telegram_client import TelegramClient, TelegramError, error_response


def send_poll(
    client: TelegramClient,
    chat_id: str,
    question: str,
    options: list[str],
    anonymous: bool = False,
    poll_type: str = "regular",
) -> dict:
    """Send a poll to a Telegram chat."""
    params: dict = {
        "chat_id": chat_id,
        "question": question,
        "options": json.dumps(options),
        "is_anonymous": anonymous,
        "type": poll_type,
    }

    result = client.api_call("sendPoll", params)

    return {
        "success": True,
        "message_id": result["message_id"],
        "poll_id": result["poll"]["id"],
    }


def main():
    parser = argparse.ArgumentParser(description="Send a Telegram poll")
    parser.add_argument("--token", help="Bot token (or set SIG_TELEGRAM_TOKEN)")
    parser.add_argument("--chat-id", required=True, help="Target chat ID")
    parser.add_argument("--question", required=True, help="Poll question")
    parser.add_argument("--options", required=True, help="Comma-separated poll options")
    parser.add_argument("--anonymous", action="store_true", help="Make poll anonymous")
    parser.add_argument("--type", default="regular", choices=["regular", "quiz"], help="Poll type (default: regular)")
    args = parser.parse_args()

    options = [o.strip() for o in args.options.split(",")]

    try:
        client = TelegramClient.create(args.token)
        result = send_poll(client, args.chat_id, args.question, options, args.anonymous, args.type)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except TelegramError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump(error_response("HTTP_" + str(e.response.status_code), str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
