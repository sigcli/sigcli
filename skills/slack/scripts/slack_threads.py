#!/usr/bin/env python3
"""Fetch thread replies from Slack."""

from __future__ import annotations

import argparse
import json
import sys

from slack_client import (
    SlackApiError,
    SlackClient,
    error_response,
    format_message,
    parse_limit,
    resolve_channel,
)


def get_thread(
    client: SlackClient,
    channel: str,
    thread_ts: str,
    limit_str: str,
    cursor: str | None,
) -> dict:
    """Fetch replies in a thread.

    Args:
        client: Authenticated Slack client.
        channel: Channel ID or #name.
        thread_ts: Parent message timestamp.
        limit_str: Time range (1d, 7d, 30d) or message count (50).
        cursor: Pagination cursor for fetching subsequent pages.

    Returns:
        Dict with channel, thread_ts, count, messages, and next_cursor.
    """
    channel_id = resolve_channel(client, channel)
    count, oldest_ts = parse_limit(limit_str)

    params: dict[str, str] = {"channel": channel_id, "ts": thread_ts}
    if oldest_ts:
        params["oldest"] = str(oldest_ts)
    if count:
        params["limit"] = str(count)
    if cursor:
        params["cursor"] = cursor

    data = client.api_call("conversations.replies", params)

    messages = []
    for msg in data.get("messages", []):
        formatted = format_message(msg)
        if formatted is not None:
            messages.append(formatted)

    next_cursor = None
    if data.get("has_more"):
        next_cursor = data.get("response_metadata", {}).get("next_cursor") or None

    return {
        "channel": channel_id,
        "thread_ts": thread_ts,
        "count": len(messages),
        "messages": messages,
        "next_cursor": next_cursor,
    }


def main():
    parser = argparse.ArgumentParser(description="Fetch thread replies from Slack.")
    parser.add_argument(
        "--channel",
        required=True,
        help="Channel ID or #name",
    )
    parser.add_argument(
        "--thread-ts",
        required=True,
        help="Parent message timestamp",
    )
    parser.add_argument(
        "--limit",
        default="1d",
        help="Time range (1d, 7d, 30d) or message count (50). Default: 1d",
    )
    parser.add_argument(
        "--cursor",
        default=None,
        help="Pagination cursor for fetching subsequent pages",
    )
    args = parser.parse_args()

    try:
        client = SlackClient.create()
        result = get_thread(client, args.channel, args.thread_ts, args.limit, args.cursor)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except SlackApiError as e:
        json.dump(error_response(e.error_code, e.message), sys.stdout, indent=2)
    except RuntimeError as e:
        json.dump(error_response("AUTH_ERROR", str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
