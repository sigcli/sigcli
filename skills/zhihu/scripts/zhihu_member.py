#!/usr/bin/env python3
"""Get Zhihu member profile and answers."""

import argparse
import json
import sys

import requests
from zhihu_client import ZHIHU_API_V4, ZhihuClient, parse_answer, parse_member


def get_member(url_token, include_answers=False, cookie=""):
    client = ZhihuClient(cookie)
    resp = client.get(f"{ZHIHU_API_V4}/members/{url_token}")
    member = parse_member(resp.json())

    result = {"member": member}

    if include_answers:
        resp = client.get(
            f"{ZHIHU_API_V4}/members/{url_token}/answers",
            params={"limit": 10, "offset": 0, "include": "data[*].content,voteup_count,comment_count"},
        )
        answers_data = resp.json()
        answers = [parse_answer(a) for a in answers_data.get("data", [])]
        result["answers"] = answers

    return result


def main():
    parser = argparse.ArgumentParser(description="Get Zhihu member profile")
    parser.add_argument("--cookie", default="", help="Zhihu session cookie (optional)")
    parser.add_argument("--url-token", required=True, help="Member URL token")
    parser.add_argument("--include-answers", action="store_true", help="Also fetch member's recent answers")
    args = parser.parse_args()

    try:
        result = get_member(args.url_token, args.include_answers, args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
