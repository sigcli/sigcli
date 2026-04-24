#!/usr/bin/env python3
"""Get V2EX node info and topics, or list all nodes."""

import argparse
import json
import sys

import requests
from v2ex_client import V2exClient, parse_topic_item


def list_all_nodes(cookie=""):
    client = V2exClient(cookie)
    nodes = client.api_v1("/nodes/all.json")
    return {
        "count": len(nodes),
        "nodes": [
            {
                "id": n.get("id"),
                "name": n.get("name", ""),
                "title": n.get("title", ""),
                "topics": n.get("topics", 0),
                "stars": n.get("stars", 0),
            }
            for n in nodes
        ],
    }


def get_node(name, page=1, cookie=""):
    client = V2exClient(cookie)
    node = client.api_v1("/nodes/show.json", params={"name": name})

    topics_data = client.api_v1("/topics/show.json", params={"node_name": name})
    topics = [parse_topic_item(t) for t in topics_data]

    return {
        "node": {
            "id": node.get("id"),
            "name": node.get("name", ""),
            "title": node.get("title", ""),
            "title_alternative": node.get("title_alternative", ""),
            "header": node.get("header", ""),
            "topics_count": node.get("topics", 0),
            "stars": node.get("stars", 0),
            "parent_node_name": node.get("parent_node_name", ""),
        },
        "topics": {"count": len(topics), "items": topics},
    }


def main():
    parser = argparse.ArgumentParser(description="Get V2EX node info and topics")
    parser.add_argument("--cookie", default="", help="V2EX session cookie (optional)")
    parser.add_argument("--name", help="Node name (e.g., python, apple)")
    parser.add_argument("--page", type=int, default=1, help="Page number (default: 1)")
    parser.add_argument("--list-all", action="store_true", help="List all available nodes")
    args = parser.parse_args()

    if not args.list_all and not args.name:
        json.dump({"error": "MISSING_ARGS", "message": "Provide --name or --list-all"}, sys.stdout, indent=2)
        return

    try:
        if args.list_all:
            result = list_all_nodes(args.cookie)
        else:
            result = get_node(args.name, args.page, args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
