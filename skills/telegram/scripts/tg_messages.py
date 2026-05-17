#!/usr/bin/env python3
"""Get recent messages via Telegram Bot API getUpdates."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from telegram_client import TelegramClient, TelegramError, error_response, parse_message


def get_messages(
    client: TelegramClient,
    limit: int = 20,
    offset: int | None = None,
) -> dict:
    """Fetch recent updates containing messages."""
    params: dict = {"limit": limit}
    if offset is not None:
        params["offset"] = offset

    updates = client.api_call("getUpdates", params)

    messages = []
    last_update_id = None
    for update in updates:
        last_update_id = update["update_id"]
        msg = update.get("message") or update.get("edited_message") or update.get("channel_post")
        if msg:
            messages.append(parse_message(msg))

    result: dict = {
        "count": len(messages),
        "messages": messages,
    }
    if last_update_id is not None:
        result["last_update_id"] = last_update_id
    return result


def main():
    parser = argparse.ArgumentParser(description="Get recent Telegram messages")
    parser.add_argument("--token", help="Bot token (or set SIG_TELEGRAM_TOKEN)")
    parser.add_argument("--limit", type=int, default=20, help="Max messages (default: 20)")
    parser.add_argument("--offset", type=int, help="Update offset for pagination")
    args = parser.parse_args()

    try:
        client = TelegramClient.create(args.token)
        result = get_messages(client, args.limit, args.offset)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except TelegramError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump(error_response("HTTP_" + str(e.response.status_code), str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
