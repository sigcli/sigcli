#!/usr/bin/env python3
"""Get top-level comments on a Xiaohongshu note."""

import argparse
import json
import sys

import requests
from xiaohongshu_client import XiaohongshuApiError, XiaohongshuClient


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu note comments")
    parser.add_argument("--note-id", required=True, help="Note ID")
    parser.add_argument("--xsec-token", required=True, help="xsec_token from search/feed result")
    parser.add_argument("--cursor", default="", help="Pagination cursor (default: '')")
    parser.add_argument("--cookie", default=None, help="Cookie override (else SIG_XIAOHONGSHU_COOKIE)")
    args = parser.parse_args()

    try:
        client = XiaohongshuClient.create(args.cookie)
        result = client.get_note_comments(args.note_id, args.xsec_token, args.cursor)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except XiaohongshuApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
