#!/usr/bin/env python3
"""Get meeting recordings and transcripts from a Teams conversation."""

import argparse
import html
import json
import os
import re
import sys
import urllib.parse

import requests

DEFAULT_REGION = "apac"


def _get_chat_base(region: str) -> str:
    return f"https://teams.cloud.microsoft/api/chatsvc/{region}/v1/users/ME"


def _headers(token: str) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _extract_urls(content: str) -> dict:
    urls = re.findall(r'https?://[^\s<>"&]+', content)
    result = {"transcripts": [], "videos": [], "sharepoint": []}
    for url in urls:
        if "/views/transcript" in url:
            result["transcripts"].append(url)
        elif "/views/video" in url:
            result["videos"].append(url)
        elif "sharepoint.com" in url or "microsoftstream.com" in url:
            result["sharepoint"].append(url)
    return result


def get_recordings(token: str, conversation_id: str, region: str = DEFAULT_REGION) -> dict:
    chat_base = _get_chat_base(region)
    encoded_id = urllib.parse.quote(conversation_id, safe="")
    url = f"{chat_base}/conversations/{encoded_id}/messages?pageSize=100"
    resp = requests.get(url, headers=_headers(token), timeout=15)
    resp.raise_for_status()

    messages = resp.json().get("messages", [])
    recordings = []

    for m in messages:
        msg_type = m.get("messagetype", "")
        content = m.get("content", "")
        is_recording = (
            msg_type == "RichText/Media_CallRecording"
            or "CallRecording" in content
            or "Recording" in content
            or "asyncgw.teams.microsoft.com" in content
        )
        if not is_recording:
            continue

        urls = _extract_urls(content)
        recordings.append({
            "id": m.get("id", ""),
            "time": m.get("composetime", ""),
            "sender": m.get("imdisplayname", ""),
            "transcriptUrls": urls["transcripts"],
            "videoUrls": urls["videos"],
            "sharepointUrls": urls["sharepoint"],
        })

    return {"conversationId": conversation_id, "count": len(recordings), "recordings": recordings}


def get_transcript(token: str, transcript_url: str) -> dict:
    """Fetch and parse a VTT transcript."""
    resp = requests.get(transcript_url, headers=_headers(token), timeout=30)
    resp.raise_for_status()

    vtt = resp.text
    segments = []
    current_speaker = ""

    for line in vtt.split("\n"):
        line = line.strip()
        if not line or line == "WEBVTT" or "-->" in line:
            continue

        # Parse speaker tags: <v Speaker Name>text</v>
        speaker_match = re.match(r"<v ([^>]+)>(.+?)(?:</v>)?$", line)
        if speaker_match:
            speaker = speaker_match.group(1)
            text = speaker_match.group(2)
        else:
            speaker = current_speaker
            text = line

        # Decode HTML entities
        text = html.unescape(text)
        text = re.sub(r"<[^>]+>", "", text)

        if not text.strip():
            continue

        if speaker == current_speaker and segments:
            segments[-1]["text"] += " " + text.strip()
        else:
            segments.append({"speaker": speaker, "text": text.strip()})
            current_speaker = speaker

    return {"url": transcript_url, "segments": segments}


def main():
    parser = argparse.ArgumentParser(description="Get meeting recordings and transcripts")
    parser.add_argument("--token", required=False, default="", help="Teams Chat API Bearer token (omit when using sig proxy)")
    parser.add_argument("--conversation-id", help="Conversation ID (for listing recordings)")
    parser.add_argument("--transcript-url", help="Teams AMS transcript URL (for fetching transcript)")
    parser.add_argument("--region", default=os.environ.get("TEAMS_REGION", DEFAULT_REGION),
                        help="Teams region (default: $TEAMS_REGION or 'apac')")
    args = parser.parse_args()

    try:
        if args.transcript_url:
            result = get_transcript(args.token, args.transcript_url)
        elif args.conversation_id:
            result = get_recordings(args.token, args.conversation_id, args.region)
        else:
            result = {"error": "MISSING_ARGS", "message": "Either --conversation-id or --transcript-url required"}
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
