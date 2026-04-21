#!/usr/bin/env python3
"""Fetch unread Slack channels and messages via the client.counts edge API."""

from __future__ import annotations

import argparse
import json
import sys

from slack_client import SlackApiError, SlackClient, error_response, format_message

# ---------------------------------------------------------------------------
# Core function
# ---------------------------------------------------------------------------


def get_unreads(
    client: SlackClient,
    type_filter: str,
    max_channels: int,
    max_messages: int,
    mentions_only: bool,
    summary_only: bool,
) -> dict:
    """Fetch unread channels and optionally backfill recent messages.

    Args:
        client: Authenticated Slack client.
        type_filter: One of "all", "dm", "group_dm", "partner", "internal".
        max_channels: Maximum number of unread channels to return.
        max_messages: Maximum messages to backfill per channel.
        mentions_only: Only include channels with mentions.
        summary_only: Skip message backfill, return counts only.

    Returns:
        Dict with unread_count, mention_count, and channels list.
    """
    # 1. Get muted channels
    try:
        prefs = client.api_call("users.prefs.get")
        muted_str = prefs.get("prefs", {}).get("muted_channels", "")
        muted = set(muted_str.split(",")) if muted_str else set()
    except SlackApiError:
        muted = set()

    # 2. Call client.counts via webclient edge API
    data = client.webclient_call(
        "client.counts",
        {
            "thread_counts_by_channel": "true",
            "org_wide_aware": "true",
            "include_file_channels": "true",
        },
    )

    # 3. Collect unread items from channels, mpims, and ims
    unread_items: list[dict] = []

    for item in data.get("channels", []):
        if item.get("has_unreads"):
            unread_items.append(
                {
                    "id": item["id"],
                    "type": "channel",
                    "mention_count": item.get("mention_count", 0),
                    "last_read": item.get("last_read", "0"),
                    "latest": item.get("latest", "0"),
                }
            )

    for item in data.get("mpims", []):
        if item.get("has_unreads"):
            unread_items.append(
                {
                    "id": item["id"],
                    "type": "group_dm",
                    "mention_count": item.get("mention_count", 0),
                    "last_read": item.get("last_read", "0"),
                    "latest": item.get("latest", "0"),
                }
            )

    for item in data.get("ims", []):
        if item.get("has_unreads"):
            unread_items.append(
                {
                    "id": item["id"],
                    "type": "dm",
                    "mention_count": item.get("mention_count", 0),
                    "last_read": item.get("last_read", "0"),
                    "latest": item.get("latest", "0"),
                }
            )

    # 4. Filter
    # Remove muted channels
    unread_items = [i for i in unread_items if i["id"] not in muted]

    # Mentions-only filter
    if mentions_only:
        unread_items = [i for i in unread_items if i["mention_count"] > 0]

    # Type filter
    if type_filter != "all":
        if type_filter == "internal":
            # Internal = channels that are not partner or DMs
            unread_items = [i for i in unread_items if i["type"] == "channel"]
        else:
            unread_items = [i for i in unread_items if i["type"] == type_filter]

    # 5. Sort: mention_count descending, then latest timestamp descending
    unread_items.sort(key=lambda x: (x["mention_count"], x["latest"]), reverse=True)

    # 6. Truncate
    unread_items = unread_items[:max_channels]

    # 7. Resolve channel names and optionally backfill messages
    total_mention_count = 0
    channels_result: list[dict] = []

    for item in unread_items:
        total_mention_count += item["mention_count"]

        # Resolve display name via conversations.info
        name = item["id"]
        try:
            info = client.api_call("conversations.info", {"channel": item["id"]})
            ch = info.get("channel", {})
            if ch.get("is_im"):
                # For DMs, show the user ID (caller can resolve further)
                name = f"@{ch.get('user', item['id'])}"
            elif ch.get("name"):
                name = f"#{ch['name']}"
        except SlackApiError:
            pass

        channel_entry: dict = {
            "id": item["id"],
            "name": name,
            "type": item["type"],
            "mention_count": item["mention_count"],
        }

        # Backfill messages if requested
        if not summary_only:
            messages: list[dict] = []
            try:
                history = client.api_call(
                    "conversations.history",
                    {
                        "channel": item["id"],
                        "oldest": item["last_read"],
                        "limit": str(max_messages),
                    },
                )
                for msg in history.get("messages", []):
                    formatted = format_message(msg)
                    if formatted is not None:
                        messages.append(formatted)
            except SlackApiError:
                pass
            channel_entry["unread_count"] = len(messages)
            channel_entry["messages"] = messages
        else:
            channel_entry["unread_count"] = None
            channel_entry["messages"] = None

        channels_result.append(channel_entry)

    return {
        "unread_count": len(channels_result),
        "mention_count": total_mention_count,
        "channels": channels_result,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Fetch unread Slack channels and messages.")
    parser.add_argument(
        "--type",
        dest="type_filter",
        default="all",
        choices=["all", "dm", "group_dm", "partner", "internal"],
        help="Filter by channel type (default: all)",
    )
    parser.add_argument(
        "--max-channels",
        type=int,
        default=50,
        help="Maximum number of unread channels to return (default: 50)",
    )
    parser.add_argument(
        "--max-messages",
        type=int,
        default=10,
        help="Maximum messages to backfill per channel (default: 10)",
    )
    parser.add_argument(
        "--mentions-only",
        action="store_true",
        help="Only include channels with mentions",
    )
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="Skip message backfill, return counts only",
    )
    args = parser.parse_args()

    try:
        client = SlackClient.create()
        result = get_unreads(
            client,
            args.type_filter,
            args.max_channels,
            args.max_messages,
            args.mentions_only,
            args.summary_only,
        )
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except SlackApiError as e:
        json.dump(error_response(e.error_code, e.message), sys.stdout, indent=2)
    except RuntimeError as e:
        json.dump(error_response("AUTH_ERROR", str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
