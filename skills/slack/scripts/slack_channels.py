#!/usr/bin/env python3
"""List Slack channels with optional sorting and pagination."""

from __future__ import annotations

import argparse
import json
import sys

from slack_client import SlackApiError, SlackClient, _build_search_channels_form, error_response


def list_channels(
    client: SlackClient,
    types: str,
    sort: str | None,
    limit: int,
    cursor: str | None,
) -> dict:
    """Fetch channels, falling back to edge API on enterprise workspaces."""
    try:
        return _list_channels_api(client, types, sort, limit, cursor)
    except SlackApiError as e:
        if e.error_code == "enterprise_is_restricted":
            return _list_channels_edge(client, sort, limit, cursor)
        raise


def _list_channels_api(
    client: SlackClient,
    types: str,
    sort: str | None,
    limit: int,
    cursor: str | None,
) -> dict:
    """List channels via conversations.list (standard API)."""
    params: dict[str, str] = {
        "types": types,
        "limit": str(min(limit, 200)),
        "exclude_archived": "true",
    }
    if cursor:
        params["cursor"] = cursor

    data = client.api_call("conversations.list", params)

    channels = []
    for ch in data.get("channels", []):
        channels.append(
            {
                "id": ch.get("id", ""),
                "name": ch.get("name", ""),
                "is_private": ch.get("is_private", False),
                "num_members": ch.get("num_members", 0),
                "topic": ch.get("topic", {}).get("value", ""),
                "purpose": ch.get("purpose", {}).get("value", ""),
            }
        )

    if sort == "popularity":
        channels.sort(key=lambda c: c["num_members"], reverse=True)

    next_cursor = data.get("response_metadata", {}).get("next_cursor") or None

    return {
        "count": len(channels),
        "channels": channels,
        "next_cursor": next_cursor,
    }


def _list_channels_edge(
    client: SlackClient,
    sort: str | None,
    limit: int,
    cursor: str | None,
) -> dict:
    """List channels via search.modules.channels (enterprise fallback)."""
    params = _build_search_channels_form(
        query="",
        count=min(limit, 100),
        cursor=cursor or "*",
        sort="member_count" if sort == "popularity" else "name",
        sort_dir="desc" if sort == "popularity" else "asc",
    )

    data = client.webclient_call("search.modules.channels", params)

    channels = []
    for item in data.get("items", []):
        channels.append(
            {
                "id": item.get("id", ""),
                "name": item.get("name", ""),
                "is_private": item.get("is_private", False),
                "num_members": item.get("member_count", 0),
                "topic": item.get("topic", {}).get("value", ""),
                "purpose": item.get("purpose", {}).get("value", ""),
            }
        )

    next_cursor = data.get("response_metadata", {}).get("next_cursor") or None

    return {
        "count": len(channels),
        "channels": channels,
        "next_cursor": next_cursor,
    }


def main():
    parser = argparse.ArgumentParser(description="List Slack channels")
    parser.add_argument(
        "--type",
        default="public_channel,private_channel",
        help="Channel types, comma-separated (default: public_channel,private_channel)",
    )
    parser.add_argument(
        "--sort",
        help='Sort order; use "popularity" to sort by num_members descending',
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Max channels to return (default: 100)",
    )
    parser.add_argument("--cursor", help="Pagination cursor for next page")
    args = parser.parse_args()

    try:
        client = SlackClient.create()
        result = list_channels(client, args.type, args.sort, args.limit, args.cursor)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except SlackApiError as e:
        json.dump(error_response(e.error_code, e.message), sys.stdout, indent=2)
    except RuntimeError as e:
        json.dump(error_response("AUTH_ERROR", str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
