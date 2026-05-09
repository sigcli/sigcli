#!/usr/bin/env python3
"""Get Xiaohongshu note detail and comments."""

import argparse
import json
import sys

from xhs_client import XhsClient, XhsApiError


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu note detail")
    parser.add_argument("--id", required=True, help="Note ID")
    parser.add_argument("--with-comments", action="store_true", help="Also fetch comments")
    args = parser.parse_args()

    client = XhsClient()
    try:
        client.connect()
        result = client.get_note(args.id)
        if args.with_comments:
            comments = client.get_comments(args.id)
            if comments:
                result["comments"] = comments.get("comments", [])
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump({"error": f"XHS_{e.code}", "message": e.msg}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)
    finally:
        client.close()


if __name__ == "__main__":
    main()
