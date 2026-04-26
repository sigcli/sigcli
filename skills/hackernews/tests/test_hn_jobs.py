"""Tests for hackernews/scripts/hn_jobs.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_jobs")

_JOB = {"id": 100, "type": "job", "title": "Acme is hiring", "by": "acme", "url": "https://acme.com/jobs"}


@responses.activate
def test_get_jobs():
    responses.get(url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/jobstories\.json"), json=[100], status=200)
    responses.get(url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/100\.json"), json=_JOB, status=200)
    result = mod.get_jobs(limit=5)
    assert result["count"] == 1
    assert result["stories"][0]["title"] == "Acme is hiring"


@responses.activate
def test_get_jobs_empty():
    responses.get(url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/jobstories\.json"), json=[], status=200)
    result = mod.get_jobs(limit=5)
    assert result["count"] == 0
