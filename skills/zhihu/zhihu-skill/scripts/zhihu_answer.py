#!/usr/bin/env python3
"""Get a single Zhihu answer by ID."""

import argparse
import json
import sys

import requests
from zhihu_client import ZHIHU_API_V4, ZhihuClient, parse_answer


def get_answer(answer_id, cookie=""):
    client = ZhihuClient(cookie)
    resp = client.get(f"{ZHIHU_API_V4}/answers/{answer_id}")
    answer = parse_answer(resp.json())
    return {"answer": answer}


def main():
    parser = argparse.ArgumentParser(description="Get a single Zhihu answer")
    parser.add_argument("--cookie", default="", help="Zhihu session cookie (optional)")
    parser.add_argument("--id", required=True, help="Answer ID")
    args = parser.parse_args()

    try:
        result = get_answer(args.id, args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
