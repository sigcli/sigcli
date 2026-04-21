#!/usr/bin/env python3
"""Get calendar events from Microsoft Graph."""

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _headers(token: str) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def get_calendar(graph_token: str, range_type: str = None, start: str = None,
                 end: str = None, limit: int = 50) -> dict:
    now = datetime.now(timezone.utc)

    if range_type == "today":
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = start_dt + timedelta(days=1)
        limit = min(limit, 20)
    elif range_type == "week":
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = start_dt + timedelta(days=7)
    elif range_type == "month":
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = start_dt + timedelta(days=30)
        limit = min(limit, 100)
    elif start and end:
        start_dt = (
            datetime.fromisoformat(start.replace("Z", "+00:00"))
            if "T" in start
            else datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        )
        end_dt = (
            datetime.fromisoformat(end.replace("Z", "+00:00"))
            if "T" in end
            else datetime.strptime(end, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        )
    else:
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = start_dt + timedelta(days=7)

    url = (
        f"{GRAPH_BASE}/me/calendarView"
        f"?startDateTime={start_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}"
        f"&endDateTime={end_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}"
        f"&$top={limit}"
        f"&$orderby=start/dateTime"
    )

    resp = requests.get(url, headers=_headers(graph_token), timeout=15)
    resp.raise_for_status()

    events = []
    for e in resp.json().get("value", []):
        organizer = e.get("organizer", {}).get("emailAddress", {})
        events.append({
            "subject": e.get("subject", ""),
            "start": e.get("start", {}).get("dateTime", ""),
            "end": e.get("end", {}).get("dateTime", ""),
            "organizer": organizer.get("name", ""),
            "location": e.get("location", {}).get("displayName", ""),
            "isOnline": e.get("isOnlineMeeting", False),
            "joinUrl": (e.get("onlineMeeting") or {}).get("joinUrl", ""),
            "attendees": len(e.get("attendees", [])),
        })

    return {"count": len(events), "events": events}


def main():
    parser = argparse.ArgumentParser(description="Get calendar events")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--range", choices=["today", "week", "month"], help="Preset range")
    parser.add_argument("--start", help="Start date (YYYY-MM-DD or ISO)")
    parser.add_argument("--end", help="End date (YYYY-MM-DD or ISO)")
    parser.add_argument("--limit", type=int, default=50, help="Max events (default: 50)")
    args = parser.parse_args()

    try:
        result = get_calendar(args.graph_token, args.range, args.start, args.end, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
