#!/usr/bin/env python3
"""Get bot info via Telegram Bot API."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from telegram_client import TelegramClient, TelegramError, error_response, parse_user


def get_me(client: TelegramClient) -> dict:
    """Fetch bot information."""
    result = client.api_call("getMe")
    return {"bot": parse_user(result)}


def main():
    parser = argparse.ArgumentParser(description="Get Telegram bot info")
    parser.add_argument("--token", help="Bot token (or set SIG_TELEGRAM_TOKEN)")
    args = parser.parse_args()

    try:
        client = TelegramClient.create(args.token)
        result = get_me(client)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except TelegramError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump(error_response("HTTP_" + str(e.response.status_code), str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
