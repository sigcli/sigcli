#!/usr/bin/env python3
"""Get Douban music/album detail."""

import argparse
import json
import sys

import requests
from douban_client import DoubanClient, parse_music


def get_music(music_id):
    client = DoubanClient()
    data = client.frodo_get(f"/music/{music_id}")
    music = parse_music(data)
    return {"music": music}


def main():
    parser = argparse.ArgumentParser(description="Get Douban music/album detail")
    parser.add_argument("--id", required=True, help="Douban music/album ID")
    args = parser.parse_args()

    try:
        result = get_music(args.id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
