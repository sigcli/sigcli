#!/usr/bin/env python3
"""Search LinkedIn posts via HTML page with RSC payload parsing."""

import argparse
import json
import re
import sys

import requests
from linkedin_client import LinkedInApiError, LinkedInClient


def search_posts(client: LinkedInClient, query: str, limit: int = 10) -> dict:
    html = client.web_get("/search/results/content/", params={"keywords": query})
    posts = []
    author_pattern = re.compile(r'\\"actorName\\":\\"([^"]+)\\"')
    url_pattern = re.compile(r'\\"postSlugUrl\\":\\"(https:[^"]+)\\"')
    text_pattern = re.compile(r'\\"children\\":\[null,\\"(.*?)\\"\]')
    authors = author_pattern.findall(html)
    urls = url_pattern.findall(html)
    texts = text_pattern.findall(html)
    count = min(len(authors), len(urls), limit)
    for i in range(count):
        text = texts[i] if i < len(texts) else ""
        text = text.replace("\\\\u00a0", " ").replace("\\\\u2019", "’").replace("\\\\n", "\n")
        post_url = urls[i].replace("\\/", "/") if i < len(urls) else ""
        posts.append({
            "rank": i + 1,
            "author": authors[i].replace("\\\\u0026", "&") if i < len(authors) else "",
            "text": text[:500],
            "url": post_url,
        })
    return {"query": query, "count": len(posts), "posts": posts}


def main():
    parser = argparse.ArgumentParser(description="Search LinkedIn posts")
    parser.add_argument("--query", required=True, help="Search keywords")
    parser.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--cookie", default="", help="LinkedIn session cookie")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie) if args.cookie else LinkedInClient.create()
        result = search_posts(client, args.query, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
