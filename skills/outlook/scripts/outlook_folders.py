#!/usr/bin/env python3
"""List mail folders from Microsoft Graph."""

import argparse
import json
import sys

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _headers(token):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    return h


def list_folders(graph_token, include_children=False):
    url = (
        GRAPH_BASE + "/me/mailFolders"
        "?$top=50"
        "&$select=id,displayName,totalItemCount,unreadItemCount,parentFolderId,childFolderCount"
    )
    resp = requests.get(url, headers=_headers(graph_token), timeout=15)
    resp.raise_for_status()

    folders = []
    for f in resp.json().get("value", []):
        entry = {
            "id": f.get("id", ""),
            "displayName": f.get("displayName", ""),
            "totalItemCount": f.get("totalItemCount", 0),
            "unreadItemCount": f.get("unreadItemCount", 0),
            "childFolderCount": f.get("childFolderCount", 0),
        }
        if include_children and f.get("childFolderCount", 0) > 0:
            child_url = (
                GRAPH_BASE + "/me/mailFolders/" + f["id"] + "/childFolders"
                "?$top=50"
                "&$select=id,displayName,totalItemCount,unreadItemCount,childFolderCount"
            )
            try:
                child_resp = requests.get(child_url, headers=_headers(graph_token), timeout=15)
                if child_resp.ok:
                    entry["children"] = [
                        {
                            "id": c.get("id", ""),
                            "displayName": c.get("displayName", ""),
                            "totalItemCount": c.get("totalItemCount", 0),
                            "unreadItemCount": c.get("unreadItemCount", 0),
                        }
                        for c in child_resp.json().get("value", [])
                    ]
            except Exception:
                pass
        folders.append(entry)

    return {"count": len(folders), "folders": folders}


def main():
    parser = argparse.ArgumentParser(description="List mail folders")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--include-children", action="store_true", help="Also list child folders")
    args = parser.parse_args()

    try:
        result = list_folders(args.graph_token, args.include_children)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
