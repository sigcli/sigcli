#!/usr/bin/env python3
"""Get notes published by a Xiaohongshu user (one page)."""

import argparse
import json
import sys

import requests
from xiaohongshu_client import XiaohongshuApiError, XiaohongshuClient


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu user's published notes")
    parser.add_argument("--user-id", required=True, help="Target user ID")
    parser.add_argument("--cursor", default="", help="Pagination cursor (default: '')")
    parser.add_argument("--xsec-token", default="", help="xsec_token if available")
    parser.add_argument("--xsec-source", default="", help="xsec_source if available (e.g. pc_feed)")
    parser.add_argument("--cookie", default=None, help="Cookie override (else SIG_XIAOHONGSHU_COOKIE)")
    args = parser.parse_args()

    try:
        client = XiaohongshuClient.create(args.cookie)
        result = client.get_user_notes(
            args.user_id,
            cursor=args.cursor,
            xsec_token=args.xsec_token,
            xsec_source=args.xsec_source,
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
