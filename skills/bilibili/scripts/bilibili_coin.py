#!/usr/bin/env python3
"""Give coins to a Bilibili video."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient


def coin_video(client: BilibiliClient, aid: int, multiply: int = 1) -> dict:
    """Give coins to a video by aid."""
    csrf = client.get_csrf()
    if multiply not in (1, 2):
        raise BilibiliApiError("INVALID_PARAM", "multiply must be 1 or 2")
    payload = client.post("/x/web-interface/coin/add", data={"aid": aid, "multiply": multiply, "csrf": csrf})
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    return {
        "success": True,
        "aid": aid,
        "multiply": multiply,
        "message": f"Gave {multiply} coin(s) to video",
    }


def main():
    parser = argparse.ArgumentParser(description="Give coins to a Bilibili video")
    parser.add_argument("--cookie", required=True, help="Bilibili session cookie")
    parser.add_argument("--aid", required=True, type=int, help="Video aid (numeric ID)")
    parser.add_argument("--multiply", type=int, default=1, choices=[1, 2], help="Number of coins: 1 or 2 (default: 1)")
    args = parser.parse_args()

    try:
        client = BilibiliClient(args.cookie)
        result = coin_video(client, args.aid, args.multiply)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
