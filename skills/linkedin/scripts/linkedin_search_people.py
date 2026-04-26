#!/usr/bin/env python3
"""Search LinkedIn people via Voyager API."""

import argparse
import json
import re
import sys

import requests
from linkedin_client import LinkedInApiError, LinkedInClient


def search_people(client: LinkedInClient, keywords: str, limit: int = 10, start: int = 0) -> dict:
    query = f"(keywords:{keywords},resultType:List(PEOPLE),origin:GLOBAL_SEARCH_HEADER)"
    params = {"q": "all", "query": query, "count": min(limit, 25), "start": start,
              "decorationId": "com.linkedin.voyager.dash.deco.search.SearchClusterCollection-187"}
    data = client.voyager_get("/voyagerSearchDashClusters", params=params)
    people = []
    for element in data.get("elements", []):
        items = element.get("items", [])
        for item in items:
            entity = (item.get("item") or {}).get("entityResult")
            if not entity:
                continue
            title_text = (entity.get("title") or {}).get("text", "")
            summary_text = (entity.get("primarySubtitle") or {}).get("text", "")
            location_text = (entity.get("secondarySubtitle") or {}).get("text", "")
            nav = (entity.get("navigationContext") or {}).get("url", "")
            urn = entity.get("entityUrn", "")
            public_id_match = re.search(r"/in/([^?/]+)", nav)
            people.append({
                "name": title_text,
                "headline": summary_text,
                "location": location_text,
                "publicIdentifier": public_id_match.group(1) if public_id_match else "",
                "profileUrl": nav.split("?")[0] if nav else "",
                "urn": urn,
            })
            if len(people) >= limit:
                break
        if len(people) >= limit:
            break
    return {"query": keywords, "count": len(people), "start": start, "people": people}


def main():
    parser = argparse.ArgumentParser(description="Search LinkedIn people")
    parser.add_argument("--query", required=True, help="Search keywords")
    parser.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--start", type=int, default=0, help="Offset for pagination")
    parser.add_argument("--cookie", default="", help="LinkedIn session cookie")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie) if args.cookie else LinkedInClient.create()
        result = search_people(client, args.query, args.limit, args.start)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
