#!/usr/bin/env python3
"""Search LinkedIn jobs via Voyager API."""

import argparse
import json
import sys
import urllib.parse

import requests
from linkedin_client import LinkedInApiError, LinkedInClient, parse_job_card

DECORATION_ID = "com.linkedin.voyager.dash.deco.jobs.search.JobSearchCardsCollection-220"


def _build_query(keywords: str, location: str = "", experience: str = "", job_type: str = "", date_posted: str = "", remote: str = "") -> str:
    parts = ["origin:JOB_SEARCH_PAGE_OTHER_ENTRY", f"keywords:{keywords}"]
    if location:
        parts.append(f"locationUnion:(seoLocation:(location:{location}))")
    filters = []
    if experience:
        filters.append(f"experience:List({experience})")
    if job_type:
        filters.append(f"jobType:List({job_type})")
    if date_posted:
        filters.append(f"timePostedRange:List({date_posted})")
    if remote:
        filters.append(f"workplaceType:List({remote})")
    if filters:
        parts.append(f"selectedFilters:({','.join(filters)})")
    parts.append("spellCorrectionEnabled:true")
    return "(" + ",".join(parts) + ")"


def _encode_query(query: str) -> str:
    encoded = urllib.parse.quote(query, safe="")
    for old, new in [("%3A", ":"), ("%2C", ","), ("%28", "("), ("%29", ")")]:
        encoded = encoded.replace(old, new)
    return encoded


def search_jobs(client: LinkedInClient, keywords: str, location: str = "", limit: int = 10, start: int = 0, **filters) -> dict:
    query = _build_query(keywords, location, **filters)
    url_path = f"/voyagerJobsDashJobCards?decorationId={DECORATION_ID}&count={min(limit, 25)}&q=jobSearch&query={_encode_query(query)}&start={start}"
    data = client.voyager_get(url_path)
    jobs = []
    for el in data.get("elements", []):
        job = parse_job_card(el)
        if job:
            jobs.append(job)
    if not jobs:
        for item in data.get("included", []):
            if item.get("jobPostingTitle") or (item.get("$type", "").endswith("JobPostingCard")):
                job = parse_job_card({"jobCardUnion": {"jobPostingCard": item}})
                if job:
                    jobs.append(job)
    for i, job in enumerate(jobs[:limit]):
        job["rank"] = start + i + 1
    return {"query": keywords, "location": location, "count": len(jobs[:limit]), "start": start, "jobs": jobs[:limit]}


def main():
    parser = argparse.ArgumentParser(description="Search LinkedIn jobs")
    parser.add_argument("--query", required=True, help="Job search keywords")
    parser.add_argument("--location", default="", help="Location")
    parser.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--start", type=int, default=0, help="Offset for pagination")
    parser.add_argument("--experience", default="", help="Experience level codes (comma-sep: 1=intern,2=entry,3=assoc,4=mid,5=dir,6=exec)")
    parser.add_argument("--job-type", default="", help="Job type codes (F=full,P=part,C=contract,T=temp,V=volunteer,I=intern)")
    parser.add_argument("--date-posted", default="", help="Date filter (r86400=24h, r604800=week, r2592000=month)")
    parser.add_argument("--remote", default="", help="Workplace type (1=onsite, 2=remote, 3=hybrid)")
    parser.add_argument("--cookie", default="", help="LinkedIn session cookie")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie) if args.cookie else LinkedInClient.create()
        result = search_jobs(client, args.query, args.location, args.limit, args.start,
                             experience=args.experience, job_type=args.job_type, date_posted=args.date_posted, remote=args.remote)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
