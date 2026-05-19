#!/usr/bin/env python3
"""Get Xiaohongshu home feed recommendations (one page)."""

import argparse
import json
import sys

import requests
from xiaohongshu_client import XiaohongshuApiError, XiaohongshuClient


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu home feed")
    parser.add_argument(
        "--category",
        default="homefeed_recommend",
        help="Channel id (default: homefeed_recommend). Use search-channels script to discover.",
    )
    parser.add_argument("--cursor-score", default="", help="Pagination cursor")
    parser.add_argument("--refresh-type", type=int, default=1, help="Refresh type (default: 1)")
    parser.add_argument("--note-index", type=int, default=0, help="Starting index (default: 0)")
    parser.add_argument("--cookie", default=None, help="Cookie override (else SIG_XIAOHONGSHU_COOKIE)")
    args = parser.parse_args()

    try:
        client = XiaohongshuClient.create(args.cookie)
        result = client.get_homefeed(
            category=args.category,
            cursor_score=args.cursor_score,
            refresh_type=args.refresh_type,
            note_index=args.note_index,
        )
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except XiaohongshuApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
