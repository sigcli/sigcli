#!/usr/bin/env python3
"""Get authenticated V2EX user profile and balance."""

import argparse
import json
import sys

import requests
from bs4 import BeautifulSoup
from v2ex_client import V2EX_BASE, V2exClient, V2exError, parse_balance_page


def get_profile(cookie):
    client = V2exClient(cookie)
    client.require_cookie()

    resp = client.get(V2EX_BASE + "/settings")
    soup = BeautifulSoup(resp.text, "html.parser")

    profile = {}
    username_el = soup.select_one("a[href^='/member/'].top")
    if username_el:
        profile["username"] = username_el.get_text(strip=True)

    avatar_el = soup.select_one("img.avatar")
    if avatar_el:
        profile["avatar"] = avatar_el.get("src", "")

    for row in soup.select("table tr"):
        cells = row.select("td")
        if len(cells) >= 2:
            label = cells[0].get_text(strip=True).lower()
            value_input = cells[1].select_one("input")
            if value_input:
                val = value_input.get("value", "")
                if "website" in label:
                    profile["website"] = val
                elif "twitter" in label:
                    profile["twitter"] = val
                elif "github" in label:
                    profile["github"] = val
                elif "location" in label:
                    profile["location"] = val
                elif "tagline" in label:
                    profile["tagline"] = val

    balance_resp = client.get(V2EX_BASE + "/balance")
    profile["balance"] = parse_balance_page(balance_resp.text)

    return {"profile": profile}


def main():
    parser = argparse.ArgumentParser(description="Get V2EX user profile and balance")
    parser.add_argument("--cookie", required=True, help="V2EX session cookie")
    args = parser.parse_args()

    try:
        result = get_profile(args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except V2exError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
