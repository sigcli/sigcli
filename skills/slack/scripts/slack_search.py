#!/usr/bin/env python3
"""Search Slack messages via the search.messages API."""

from __future__ import annotations

import argparse
import base64
import json
import sys

from slack_client import SlackApiError, SlackClient, error_response

# ---------------------------------------------------------------------------
# Query builder
# ---------------------------------------------------------------------------


def build_search_query(
    query: str | None,
    channel: str | None,
    from_user: str | None,
    before: str | None,
    after: str | None,
    on: str | None,
    threads_only: bool,
) -> str:
    """Assemble a Slack search query string from individual filters.

    Raises:
        ValueError: If the resulting query is empty.
    """
    parts: list[str] = []

    if query:
        parts.append(query)
    if channel:
        parts.append(f"in:{channel}")
    if from_user:
        parts.append(f"from:{from_user}")
    if before:
        parts.append(f"before:{before}")
    if after:
        parts.append(f"after:{after}")
    if on:
        parts.append(f"on:{on}")
    if threads_only:
        parts.append("is:thread")

    result = " ".join(parts).strip()
    if not result:
        raise ValueError("Search query is empty. Provide --query or at least one filter.")
    return result


# ---------------------------------------------------------------------------
# Cursor helpers (base64 page number)
# ---------------------------------------------------------------------------


def decode_search_cursor(cursor: str | None) -> int:
    """Decode a base64 cursor to a page number.  Returns 1 if absent."""
    if not cursor:
        return 1
    try:
        decoded = base64.b64decode(cursor).decode()
        # Expected format: "page:N"
        _, _, page_str = decoded.partition(":")
        return int(page_str)
    except Exception:
        return 1


def encode_search_cursor(page: int) -> str:
    """Encode a page number into a base64 cursor string."""
    return base64.b64encode(f"page:{page}".encode()).decode()


# ---------------------------------------------------------------------------
# Core function
# ---------------------------------------------------------------------------


def search_messages(
    client: SlackClient,
    query_str: str,
    limit: int,
    page: int,
) -> dict:
    """Execute a Slack message search.

    Args:
        client: Authenticated Slack client.
        query_str: Fully assembled search query string.
        limit: Maximum number of results per page.
        page: 1-based page number.

    Returns:
        Dict with query, count, total, messages, and next_cursor.
    """
    data = client.api_call(
        "search.messages",
        {"query": query_str, "count": str(limit), "page": str(page)},
    )

    messages_data = data.get("messages", {})
    matches = messages_data.get("matches", [])

    results = []
    for m in matches:
        ch = m.get("channel", {})
        results.append(
            {
                "ts": m.get("ts", ""),
                "channel": {
                    "id": ch.get("id", ""),
                    "name": ch.get("name", ""),
                },
                "user": m.get("user", m.get("username", "")),
                "text": m.get("text", ""),
                "permalink": m.get("permalink", ""),
            }
        )

    # Pagination
    pagination = messages_data.get("pagination", {})
    current_page = pagination.get("page", page)
    page_count = pagination.get("page_count", 1)
    next_cursor = None
    if current_page < page_count:
        next_cursor = encode_search_cursor(current_page + 1)

    return {
        "query": query_str,
        "count": len(results),
        "total": messages_data.get("total", 0),
        "messages": results,
        "next_cursor": next_cursor,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Search Slack messages via the search.messages API.")
    parser.add_argument(
        "--query",
        default=None,
        help="Free-text search query (optional if other filters given)",
    )
    parser.add_argument(
        "--channel",
        default=None,
        help="Filter to channel (#name or channel ID)",
    )
    parser.add_argument(
        "--from",
        dest="from_user",
        default=None,
        help="Filter by sender (@name or user ID)",
    )
    parser.add_argument(
        "--before",
        default=None,
        help="Before date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--after",
        default=None,
        help="After date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--on",
        default=None,
        help="On specific date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--threads-only",
        action="store_true",
        help="Only return messages that are part of a thread",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum number of results (default: 20)",
    )
    parser.add_argument(
        "--cursor",
        default=None,
        help="Pagination cursor (base64-encoded page number)",
    )
    args = parser.parse_args()

    try:
        query_str = build_search_query(
            args.query,
            args.channel,
            args.from_user,
            args.before,
            args.after,
            args.on,
            args.threads_only,
        )
        page = decode_search_cursor(args.cursor)
        client = SlackClient.create()
        result = search_messages(client, query_str, args.limit, page)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except SlackApiError as e:
        json.dump(error_response(e.error_code, e.message), sys.stdout, indent=2)
    except RuntimeError as e:
        json.dump(error_response("AUTH_ERROR", str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
