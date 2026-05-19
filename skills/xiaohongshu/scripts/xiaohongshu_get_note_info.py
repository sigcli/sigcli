#!/usr/bin/env python3
"""Get full detail of a Xiaohongshu note by URL."""

import argparse
import json
import sys

import requests
from xiaohongshu_client import XiaohongshuApiError, XiaohongshuClient


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu note detail")
    parser.add_argument(
        "--url",
        required=True,
        help="Full note URL, e.g. https://www.xiaohongshu.com/explore/<id>?xsec_token=...&xsec_source=pc_search",
    )
    parser.add_argument("--cookie", default=None, help="Cookie override (else SIG_XIAOHONGSHU_COOKIE)")
    args = parser.parse_args()

    try:
        client = XiaohongshuClient.create(args.cookie)
        result = client.get_note_info(args.url)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except XiaohongshuApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
