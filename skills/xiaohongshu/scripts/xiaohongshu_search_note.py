#!/usr/bin/env python3
"""Search Xiaohongshu notes by keyword."""

import argparse
import json
import sys

import requests
from xiaohongshu_client import XiaohongshuApiError, XiaohongshuClient


def main():
    parser = argparse.ArgumentParser(description="Search Xiaohongshu notes")
    parser.add_argument("--keyword", required=True, help="Search keyword")
    parser.add_argument("--page", type=int, default=1, help="Page number (default: 1)")
    parser.add_argument(
        "--sort",
        type=int,
        default=0,
        choices=[0, 1, 2, 3, 4],
        help="0=general, 1=newest, 2=most-liked, 3=most-commented, 4=most-collected",
    )
    parser.add_argument(
        "--note-type",
        type=int,
        default=0,
        choices=[0, 1, 2],
        help="0=any, 1=video, 2=image",
    )
    parser.add_argument("--cookie", default=None, help="Cookie override (else SIG_XIAOHONGSHU_COOKIE)")
    args = parser.parse_args()

    try:
        client = XiaohongshuClient.create(args.cookie)
        result = client.search_note(
            args.keyword,
            page=args.page,
            sort=args.sort,
            note_type=args.note_type,
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
