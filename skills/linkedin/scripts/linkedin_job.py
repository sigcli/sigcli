#!/usr/bin/env python3
"""Get LinkedIn job posting details."""

import argparse
import json
import sys

import requests
from linkedin_client import LinkedInApiError, LinkedInClient, resolve_job_id


def get_job(client: LinkedInClient, job_id: str) -> dict:
    data = client.voyager_get(f"/jobs/jobPostings/{job_id}")
    title = (data.get("title") or {}).get("text", "") if isinstance(data.get("title"), dict) else data.get("title", "")
    company = (data.get("companyDetails") or {}).get("company", "")
    if isinstance(company, dict):
        company = company.get("name", "")
    desc = (data.get("description") or {}).get("text", "") if isinstance(data.get("description"), dict) else data.get("description", "")
    location = data.get("formattedLocation", "")
    workplace = data.get("workplaceTypesResolutionResults", {})
    workplace_type = ""
    for wt in workplace.values():
        workplace_type = (wt.get("localizedName", "") if isinstance(wt, dict) else "")
        break
    return {
        "jobId": job_id,
        "title": title,
        "company": company,
        "location": location,
        "workplaceType": workplace_type,
        "description": desc[:2000],
        "listedAt": data.get("listedAt", 0),
        "applies": data.get("applies", 0),
        "views": data.get("views", 0),
        "url": f"https://www.linkedin.com/jobs/view/{job_id}",
    }


def main():
    parser = argparse.ArgumentParser(description="Get LinkedIn job details")
    parser.add_argument("--id", required=True, help="Job ID or LinkedIn job URL")
    parser.add_argument("--cookie", default="", help="LinkedIn session cookie")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie) if args.cookie else LinkedInClient.create()
        job_id = resolve_job_id(args.id)
        result = get_job(client, job_id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
