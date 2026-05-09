#!/usr/bin/env python3
"""Search Xiaohongshu notes."""

import argparse
import json
import sys

from xhs_client import XhsClient, XhsApiError


def main():
    parser = argparse.ArgumentParser(description="Search Xiaohongshu notes")
    parser.add_argument("--query", required=True, help="Search keyword")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20)")
    parser.add_argument("--sort", default="general", choices=["general", "time_descending", "popularity_descending"])
    args = parser.parse_args()

    client = XhsClient()
    try:
        client.connect()
        result = client.search_notes(args.query, args.sort)
        result["query"] = args.query
        result["sort"] = args.sort
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
