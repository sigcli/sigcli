#!/usr/bin/env python3
"""Add or remove a reaction on a Slack message."""

from __future__ import annotations

import argparse
import json
import sys

from slack_client import SlackApiError, SlackClient, error_response


def manage_reaction(
    client: SlackClient,
    action: str,
    channel: str,
    timestamp: str,
    emoji: str,
) -> dict:
    """Add or remove a reaction via reactions.add / reactions.remove."""
    client.api_call(
        f"reactions.{action}",
        {
            "channel": channel,
            "timestamp": timestamp,
            "name": emoji,
        },
    )
    return {
        "success": True,
        "action": action,
        "channel": channel,
        "timestamp": timestamp,
        "emoji": emoji,
    }


def main():
    parser = argparse.ArgumentParser(description="Add or remove a Slack reaction")
    parser.add_argument(
        "--action",
        required=True,
        choices=["add", "remove"],
        help="Reaction action",
    )
    parser.add_argument("--channel", required=True, help="Channel ID")
    parser.add_argument(
        "--timestamp",
        required=True,
        help="Message timestamp (e.g. 1234567890.123456)",
    )
    parser.add_argument(
        "--emoji",
        required=True,
        help="Emoji name without colons (e.g. thumbsup)",
    )
    args = parser.parse_args()

    try:
        client = SlackClient.create()
        result = manage_reaction(client, args.action, args.channel, args.timestamp, args.emoji)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except SlackApiError as e:
        json.dump(error_response(e.error_code, e.message), sys.stdout, indent=2)
    except RuntimeError as e:
        json.dump(error_response("AUTH_ERROR", str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
