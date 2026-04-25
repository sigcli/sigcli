#!/usr/bin/env python3
"""Get current Bilibili user profile."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient


def get_me(client: BilibiliClient) -> dict:
    """Fetch the authenticated user's profile via /x/web-interface/nav."""
    client.require_cookie()
    payload = client.get("/x/web-interface/nav")
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    data = payload.get("data", {})
    return {
        "mid": data.get("mid", 0),
        "name": data.get("uname", ""),
        "face": data.get("face", ""),
        "level": data.get("level_info", {}).get("current_level", 0),
        "coins": data.get("money", 0),
        "vip_type": data.get("vipType", 0),
        "vip_label": data.get("vip", {}).get("label", {}).get("text", ""),
        "is_login": data.get("isLogin", False),
        "email_verified": data.get("email_verified", 0),
        "phone_verified": data.get("mobile_verified", 0),
    }


def main():
    parser = argparse.ArgumentParser(description="Get current Bilibili user profile")
    parser.add_argument("--cookie", default="", help="Bilibili session cookie")
    args = parser.parse_args()

    try:
        client = BilibiliClient(args.cookie) if args.cookie else BilibiliClient.create()
        result = get_me(client)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
