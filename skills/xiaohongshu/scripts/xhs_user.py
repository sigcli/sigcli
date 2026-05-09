#!/usr/bin/env python3
"""Get Xiaohongshu user profile."""

import argparse
import json
import sys

from xhs_client import XhsClient, XhsApiError


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu user profile")
    parser.add_argument("--user-id", required=True, help="User ID")
    args = parser.parse_args()

    client = XhsClient()
    try:
        client.connect()
        result = client.get_user(args.user_id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump({"error": f"XHS_{e.code}", "message": e.msg}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)
    finally:
        client.close()


if __name__ == "__main__":
    main()
