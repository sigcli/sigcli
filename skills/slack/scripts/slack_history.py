#!/usr/bin/env python3
"""Fetch channel message history from Slack."""

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


def get_history(
    client: SlackClient,
    channel: str,
    limit_str: str,
    cursor: str | None,
    include_activity: bool,
) -> dict:
    """Fetch conversation history for a channel.

    Args:
        client: Authenticated Slack client.
        channel: Channel ID, #name, or @user.
        limit_str: Time range (1d, 7d, 30d) or message count (50).
        cursor: Pagination cursor for fetching subsequent pages.
        include_activity: Whether to include join/leave activity messages.

    Returns:
        Dict with channel, count, messages, and next_cursor.
    """
    channel_id = resolve_channel(client, channel)
    count, oldest_ts = parse_limit(limit_str)

    params: dict[str, str] = {"channel": channel_id}
    if oldest_ts:
        params["oldest"] = str(oldest_ts)
        params["limit"] = "200"
    if count:
        params["limit"] = str(count)
    if cursor:
        params["cursor"] = cursor

    data = client.api_call("conversations.history", params)

    messages = []
    for msg in data.get("messages", []):
        formatted = format_message(msg, include_activity)
        if formatted is not None:
            # Auto-expand threads: fetch replies for messages with threads
            if msg.get("reply_count", 0) > 0 and msg.get("thread_ts"):
                replies = _fetch_thread_replies(client, channel_id, msg["thread_ts"], include_activity)
                formatted["replies"] = replies
            messages.append(formatted)

    next_cursor = None
    if data.get("has_more"):
        next_cursor = data.get("response_metadata", {}).get("next_cursor") or None

    return {
        "channel": channel_id,
        "count": len(messages),
        "messages": messages,
        "next_cursor": next_cursor,
    }


def _fetch_thread_replies(
    client: SlackClient,
    channel_id: str,
    thread_ts: str,
    include_activity: bool,
) -> list[dict]:
    """Fetch thread replies for a message, excluding the parent."""
    try:
        data = client.api_call(
            "conversations.replies",
            {"channel": channel_id, "ts": thread_ts, "limit": "50"},
        )
    except SlackApiError:
        return []

    replies = []
    for msg in data.get("messages", []):
        # Skip the parent message (same ts as thread_ts)
        if msg.get("ts") == thread_ts:
            continue
        formatted = format_message(msg, include_activity)
        if formatted is not None:
            replies.append(formatted)
    return replies


def main():
    parser = argparse.ArgumentParser(description="Fetch channel message history from Slack.")
    parser.add_argument(
        "--channel",
        required=True,
        help="Channel ID, #name, or @user",
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
    parser.add_argument(
        "--include-activity",
        action="store_true",
        help="Include join/leave activity messages",
    )
    args = parser.parse_args()

    try:
        client = SlackClient.create()
        result = get_history(client, args.channel, args.limit, args.cursor, args.include_activity)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except SlackApiError as e:
        json.dump(error_response(e.error_code, e.message), sys.stdout, indent=2)
    except RuntimeError as e:
        json.dump(error_response("AUTH_ERROR", str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
