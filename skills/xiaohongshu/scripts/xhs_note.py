#!/usr/bin/env python3
"""Get note detail from Xiaohongshu."""

import argparse
import json
import sys

import requests
from xhs_client import XHS_WEB, XhsApiError, XhsClient, error_response, parse_initial_state, parse_note, parse_note_id


def get_note(client: XhsClient, note_input: str, xsec_token: str = "") -> dict:
    """Fetch a note by ID or URL, parsing SSR HTML for embedded data."""
    note_id = parse_note_id(note_input)
    url = f"{XHS_WEB}/explore/{note_id}"
    if xsec_token:
        url += f"?xsec_token={xsec_token}&xsec_source=pc_search"

    html = client.fetch_html(url)
    state = parse_initial_state(html)

    note_state = state.get("note") or {}
    detail_map = note_state.get("noteDetailMap") or note_state.get("note_detail_map") or {}

    note_data = detail_map.get(note_id) or {}
    if not note_data:
        for val in detail_map.values():
            note_data = val
            break

    if not note_data:
        raise XhsApiError("NOT_FOUND", f"Note {note_id} not found in page data")

    return parse_note(note_data)


def main():
    parser = argparse.ArgumentParser(description="Get note detail from Xiaohongshu")
    parser.add_argument("--id", required=True, help="Note ID, URL, or explore link")
    parser.add_argument("--xsec-token", default="", help="xsec_token for signed access")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = get_note(client, args.id, args.xsec_token)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump(error_response(f"HTTP_{e.response.status_code}", str(e)), sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
