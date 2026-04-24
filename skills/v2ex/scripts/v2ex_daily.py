#!/usr/bin/env python3
"""V2EX daily sign-in to redeem coins."""

import argparse
import json
import re
import sys

import requests

from v2ex_client import V2EX_BASE, V2exClient, V2exError


def daily_checkin(cookie):
    client = V2exClient(cookie)
    client.require_cookie()

    resp = client.get(V2EX_BASE + "/mission/daily")
    html = resp.text

    if "每日登录奖励已领取" in html:
        return {
            "success": True,
            "already_claimed": True,
            "message": "Daily reward already claimed today",
        }

    match = re.search(r"/mission/daily/redeem\?once=(\d+)", html)
    if not match:
        once_match = re.search(r'name="once"\s+value="(\d+)"', html)
        if not once_match:
            raise V2exError("ONCE_NOT_FOUND", "Cannot find redeem link — session may be expired")
        once = once_match.group(1)
    else:
        once = match.group(1)

    redeem_url = V2EX_BASE + "/mission/daily/redeem?once=" + once
    resp = client.get(redeem_url)

    if "已成功领取" in resp.text or "每日登录奖励已领取" in resp.text:
        return {
            "success": True,
            "already_claimed": False,
            "message": "Daily reward redeemed successfully",
        }

    return {
        "success": True,
        "already_claimed": False,
        "message": "Daily check-in completed",
    }


def main():
    parser = argparse.ArgumentParser(description="V2EX daily sign-in")
    parser.add_argument("--cookie", required=True, help="V2EX session cookie")
    args = parser.parse_args()

    try:
        result = daily_checkin(args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except V2exError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
