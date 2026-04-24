#!/usr/bin/env python3
"""Get Zhihu question detail and answers."""

import argparse
import json
import sys

import requests
from zhihu_client import ZHIHU_API_V4, ZhihuClient, parse_answer, parse_question


def get_question(question_id, answers_limit=10, sort="default", cookie=""):
    client = ZhihuClient(cookie)

    params = {"limit": answers_limit, "offset": 0, "sort_by": sort}
    resp = client.get(f"{ZHIHU_API_V4}/questions/{question_id}/answers", params=params)
    answers_data = resp.json()
    answers = [parse_answer(a) for a in answers_data.get("data", [])]

    question = None
    if answers:
        q = answers_data["data"][0].get("question", {})
        question = {"id": q.get("id"), "title": q.get("title", ""), "type": "question"}
    else:
        question = {"id": int(question_id), "title": "", "type": "question"}

    return {
        "question": question,
        "answers": {"count": len(answers), "items": answers},
    }


def main():
    parser = argparse.ArgumentParser(description="Get Zhihu question detail and answers")
    parser.add_argument("--cookie", default="", help="Zhihu session cookie (optional)")
    parser.add_argument("--id", required=True, help="Question ID")
    parser.add_argument("--answers-limit", type=int, default=10, help="Max answers (default: 10)")
    parser.add_argument("--sort", default="default", choices=["default", "created"], help="Sort answers (default: default)")
    args = parser.parse_args()

    try:
        result = get_question(args.id, args.answers_limit, args.sort, args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
