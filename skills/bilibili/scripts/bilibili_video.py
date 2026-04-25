#!/usr/bin/env python3
"""Get Bilibili video details by BV ID."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient, parse_video


def get_video(client: BilibiliClient, bvid: str) -> dict:
    """Fetch video details by BV ID."""
    payload = client.get("/x/web-interface/view", params={"bvid": bvid})
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    return parse_video(payload.get("data", {}))


def main():
    parser = argparse.ArgumentParser(description="Get Bilibili video details")
    parser.add_argument("--bvid", required=True, help="Video BV ID (e.g. BV1xx411c7mD)")
    args = parser.parse_args()

    try:
        client = BilibiliClient.create()
        result = get_video(client, args.bvid)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
