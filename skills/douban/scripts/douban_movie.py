#!/usr/bin/env python3
"""Get Douban movie detail and reviews."""

import argparse
import json
import sys

import requests
from douban_client import DoubanClient, parse_interest, parse_movie


def get_movie(movie_id, include_reviews=False):
    client = DoubanClient()
    data = client.frodo_get(f"/movie/{movie_id}")
    movie = parse_movie(data)
    result = {"movie": movie}
    if include_reviews:
        reviews_data = client.frodo_get(f"/movie/{movie_id}/interests", params={"start": 0, "count": 10})
        interests = reviews_data.get("interests", [])
        result["reviews"] = [parse_interest(i) for i in interests if i]
    return result


def main():
    parser = argparse.ArgumentParser(description="Get Douban movie detail")
    parser.add_argument("--id", required=True, help="Douban movie ID")
    parser.add_argument("--include-reviews", action="store_true", help="Also fetch recent reviews")
    args = parser.parse_args()

    try:
        result = get_movie(args.id, args.include_reviews)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
