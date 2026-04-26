#!/usr/bin/env python3
"""Send a LinkedIn connection request."""

import argparse
import json
import sys

import requests
from linkedin_client import LinkedInApiError, LinkedInClient


def send_connection(client: LinkedInClient, profile_urn: str, message: str = "") -> dict:
    payload = {"inviteeProfileUrn": profile_urn}
    if message:
        payload["customMessage"] = message
    client.voyager_post("/voyagerRelationshipsDashMemberRelationships", json_data=payload)
    return {"success": True, "profileUrn": profile_urn, "action": "connection_sent", "message": "Connection request sent"}


def main():
    parser = argparse.ArgumentParser(description="Send a LinkedIn connection request")
    parser.add_argument("--cookie", required=True, help="LinkedIn session cookie")
    parser.add_argument("--urn", required=True, help="Profile URN (e.g., urn:li:fsd_profile:ACoAA...)")
    parser.add_argument("--message", default="", help="Custom connection message (optional)")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie)
        result = send_connection(client, args.urn, args.message)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
