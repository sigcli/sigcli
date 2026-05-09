#!/usr/bin/env python3
"""Get Xiaohongshu explore/trending feed."""

import argparse
import json
import sys

from xhs_client import XhsClient, XhsApiError


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu explore feed")
    parser.add_argument("--limit", type=int, default=20, help="Max notes (default: 20)")
    args = parser.parse_args()

    client = XhsClient()
    try:
        client.connect()
        # Explore feed is loaded via homefeed API when navigating to /explore
        result = client.search_notes("热门", "popularity_descending")
        result["source"] = "trending"
        if args.limit < len(result.get("notes", [])):
            result["notes"] = result["notes"][: args.limit]
            result["count"] = args.limit
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump({"error": f"XHS_{e.code}", "message": e.msg}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)
    finally:
        client.close()


if __name__ == "__main__":
    main()
