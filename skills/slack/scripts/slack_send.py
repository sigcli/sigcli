#!/usr/bin/env python3
"""Send a message or threaded reply in Slack."""

from __future__ import annotations

import argparse
import json
import sys

from slack_client import SlackApiError, SlackClient, error_response, resolve_channel


def send_message(
    client: SlackClient,
    channel: str,
    message: str,
    thread_ts: str | None,
    fmt: str,
) -> dict:
    """Post a message to a Slack channel or thread."""
    channel_id = resolve_channel(client, channel)

    params: dict[str, str] = {
        "channel": channel_id,
        "text": message,
    }
    if thread_ts:
        params["thread_ts"] = thread_ts
    if fmt == "text/markdown":
        params["mrkdwn"] = "true"

    resp = client.api_call("chat.postMessage", params)

    return {
        "success": True,
        "channel": resp["channel"],
        "ts": resp["ts"],
        "message": "Message sent",
    }


def main():
    parser = argparse.ArgumentParser(description="Send a Slack message")
    parser.add_argument(
        "--channel",
        required=True,
        help="Channel ID, #channel-name, or @username",
    )
    parser.add_argument("--message", required=True, help="Message text")
    parser.add_argument(
        "--thread-ts",
        help="Thread parent timestamp for a threaded reply",
    )
    parser.add_argument(
        "--format",
        default="text/markdown",
        choices=["text/markdown", "text/plain"],
        help="Message format (default: text/markdown)",
    )
    args = parser.parse_args()

    try:
        client = SlackClient.create()
        result = send_message(client, args.channel, args.message, args.thread_ts, args.format)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except SlackApiError as e:
        json.dump(error_response(e.error_code, e.message), sys.stdout, indent=2)
    except RuntimeError as e:
        json.dump(error_response("AUTH_ERROR", str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
