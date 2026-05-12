#!/usr/bin/env python3
"""Get Douban Top 250 movies via HTML scraping."""

import argparse
import json
import sys

import requests
from douban_client import DoubanClient, parse_top250_page


def get_top250(page=1):
    client = DoubanClient()
    start = (page - 1) * 25
    html = client.html_get("https://movie.douban.com/top250", params={"start": start})
    movies = parse_top250_page(html)
    return {
        "page": page,
        "count": len(movies),
        "movies": movies,
    }


def main():
    parser = argparse.ArgumentParser(description="Get Douban Top 250 movies")
    parser.add_argument("--page", type=int, default=1, help="Page number (default: 1, 25 movies per page)")
    args = parser.parse_args()

    try:
        result = get_top250(args.page)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
