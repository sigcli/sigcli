#!/usr/bin/env python3
"""Search people, get manager, direct reports, or profile via Microsoft Graph."""

import argparse
import json
import sys
import urllib.parse

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _headers(token: str, extra: dict = None) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if extra:
        h.update(extra)
    return h


def _format_user(u: dict) -> dict:
    emails = u.get("scoredEmailAddresses") or []
    email = emails[0].get("address", "") if emails else u.get("mail", "")
    phones = u.get("phones") or u.get("businessPhones") or []
    phone = ""
    if isinstance(phones, list) and phones:
        if isinstance(phones[0], str):
            phone = phones[0]
        elif isinstance(phones[0], dict):
            phone = phones[0].get("number", "")
    return {
        "id": u.get("id", ""),
        "name": u.get("displayName", ""),
        "email": email,
        "phone": phone,
        "department": u.get("department", ""),
        "jobTitle": u.get("jobTitle", ""),
        "office": u.get("officeLocation", ""),
        "iNumber": u.get("mailNickname", ""),
        "city": u.get("city", ""),
        "country": u.get("country", ""),
    }


def search_people(graph_token: str, query: str, limit: int = 10, enrich: bool = False) -> dict:
    # Search known contacts
    encoded = urllib.parse.quote(f'"{query}"')
    url = f"{GRAPH_BASE}/me/people?$search={encoded}&$top={limit}"
    resp = requests.get(url, headers=_headers(graph_token), timeout=15)
    resp.raise_for_status()
    results = [_format_user(u) for u in resp.json().get("value", [])]

    # Also search directory if few results
    if len(results) < 3:
        dir_url = (
            f"{GRAPH_BASE}/users?$search=\"displayName:{query}\""
            f"&$select=id,displayName,givenName,surname,mail,department,jobTitle,officeLocation,companyName,userPrincipalName,mailNickname,city,country"
            f"&$count=true&$top={limit}"
        )
        try:
            dir_resp = requests.get(dir_url, headers=_headers(graph_token, {"ConsistencyLevel": "eventual"}), timeout=15)
            if dir_resp.ok:
                existing_ids = {r["id"] for r in results}
                for u in dir_resp.json().get("value", []):
                    if u.get("id") not in existing_ids:
                        results.append(_format_user(u))
        except Exception:
            pass

    # Enrich with extra fields if requested
    if enrich:
        for r in results:
            if r["id"] and (not r.get("iNumber") or not r.get("city")):
                try:
                    user_resp = requests.get(
                        f"{GRAPH_BASE}/users/{r['id']}?$select=mailNickname,city,country",
                        headers=_headers(graph_token), timeout=10
                    )
                    if user_resp.ok:
                        data = user_resp.json()
                        r["iNumber"] = r["iNumber"] or data.get("mailNickname", "")
                        r["city"] = r["city"] or data.get("city", "")
                        r["country"] = r["country"] or data.get("country", "")
                except Exception:
                    pass

    return {"count": len(results), "results": results[:limit]}


def get_manager(graph_token: str) -> dict:
    resp = requests.get(f"{GRAPH_BASE}/me/manager", headers=_headers(graph_token), timeout=15)
    if resp.status_code == 404:
        return {"manager": None, "message": "No manager found"}
    resp.raise_for_status()
    return {"manager": _format_user(resp.json())}


def get_direct_reports(graph_token: str, limit: int = 50) -> dict:
    resp = requests.get(f"{GRAPH_BASE}/me/directReports?$top={limit}",
                        headers=_headers(graph_token), timeout=15)
    resp.raise_for_status()
    reports = [_format_user(u) for u in resp.json().get("value", [])]
    return {"count": len(reports), "reports": reports}


def get_profile(graph_token: str) -> dict:
    resp = requests.get(f"{GRAPH_BASE}/me", headers=_headers(graph_token), timeout=15)
    resp.raise_for_status()
    return {"profile": _format_user(resp.json())}


def main():
    parser = argparse.ArgumentParser(description="Search people / org chart / profile")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--action", choices=["search", "manager", "reports", "profile"],
                        default="search", help="Action (default: search)")
    parser.add_argument("--query", help="Search query (for search action)")
    parser.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--enrich", action="store_true", help="Fetch extra details (I-number, city, country)")
    args = parser.parse_args()

    try:
        if args.action == "search":
            if not args.query:
                parser.error("--query is required for search")
            result = search_people(args.graph_token, args.query, args.limit, args.enrich)
        elif args.action == "manager":
            result = get_manager(args.graph_token)
        elif args.action == "reports":
            result = get_direct_reports(args.graph_token, args.limit)
        elif args.action == "profile":
            result = get_profile(args.graph_token)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
