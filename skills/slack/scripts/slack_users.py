#!/usr/bin/env python3
"""Search Slack users by name, email, or display name."""

from __future__ import annotations

import argparse
import json
import sys

from slack_client import SlackApiError, SlackClient, error_response

# ---------------------------------------------------------------------------
# Core function
# ---------------------------------------------------------------------------


def search_users(client: SlackClient, query: str, limit: int) -> dict:
    """Search for Slack users.

    Prefers the edge users/search API (fast, server-side search) and falls
    back to the standard users.list API with client-side filtering.
    """
    try:
        return _search_users_edge(client, query, limit)
    except Exception:
        return _search_users_api(client, query, limit)


def _search_users_api(client: SlackClient, query: str, limit: int) -> dict:
    """Search users via users.list (standard API) with client-side filtering."""
    query_lower = query.lower()
    results: list[dict] = []

    cursor: str | None = None
    while True:
        params: dict[str, str] = {"limit": "200"}
        if cursor:
            params["cursor"] = cursor

        data = client.api_call("users.list", params)

        for user in data.get("members", []):
            # Skip deleted users, bots, and Slackbot
            if user.get("deleted"):
                continue
            if user.get("is_bot"):
                continue
            if user.get("id") == "USLACKBOT":
                continue

            profile = user.get("profile", {})
            fields = [
                user.get("name", ""),
                user.get("real_name", ""),
                profile.get("display_name", ""),
                profile.get("email", ""),
            ]

            if any(query_lower in field.lower() for field in fields if field):
                results.append(
                    {
                        "id": user["id"],
                        "name": user.get("name", ""),
                        "real_name": user.get("real_name", ""),
                        "display_name": profile.get("display_name", ""),
                        "email": profile.get("email", ""),
                        "title": profile.get("title", ""),
                        "is_bot": user.get("is_bot", False),
                    }
                )
                if len(results) >= limit:
                    break

        if len(results) >= limit:
            break

        cursor = data.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            break

    return {
        "query": query,
        "count": len(results),
        "users": results[:limit],
    }


def _search_users_edge(client: SlackClient, query: str, limit: int) -> dict:
    """Search users via edge users/search API (enterprise fallback)."""
    data = client.edge_api_call("users/search", {"query": query, "count": limit})

    results: list[dict] = []
    for user in data.get("results", []):
        if user.get("deleted"):
            continue
        if user.get("is_bot"):
            continue
        if user.get("id") == "USLACKBOT":
            continue

        profile = user.get("profile", {})
        results.append(
            {
                "id": user["id"],
                "name": user.get("name", ""),
                "real_name": user.get("real_name", ""),
                "display_name": profile.get("display_name", ""),
                "email": profile.get("email", ""),
                "title": profile.get("title", ""),
                "is_bot": user.get("is_bot", False),
            }
        )

    return {
        "query": query,
        "count": len(results),
        "users": results[:limit],
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Search Slack users by name, email, or display name.")
    parser.add_argument(
        "--query",
        required=True,
        help="Search by name, email, or display name",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum number of results (default: 10)",
    )
    args = parser.parse_args()

    try:
        client = SlackClient.create()
        result = search_users(client, args.query, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except SlackApiError as e:
        json.dump(error_response(e.error_code, e.message), sys.stdout, indent=2)
    except RuntimeError as e:
        json.dump(error_response("AUTH_ERROR", str(e)), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
