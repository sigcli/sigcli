"""Tests for msteams/scripts/teams_meetings.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("msteams", "teams_meetings")


class TestExtractUrls:
    def test_transcript_url(self):
        content = (
            'Check <a href="https://eu-prod.asyncgw.teams.microsoft.com/v1/objects/abc/views/transcript">transcript</a>'
        )
        urls = mod._extract_urls(content)
        assert len(urls["transcripts"]) == 1
        assert "views/transcript" in urls["transcripts"][0]

    def test_video_url(self):
        content = '<a href="https://eu-prod.asyncgw.teams.microsoft.com/v1/objects/abc/views/video">video</a>'
        urls = mod._extract_urls(content)
        assert len(urls["videos"]) == 1

    def test_sharepoint_url(self):
        content = '<a href="https://contoso.sharepoint.com/sites/team/recording.mp4">link</a>'
        urls = mod._extract_urls(content)
        assert len(urls["sharepoint"]) == 1

    def test_mixed_urls(self):
        content = (
            "https://eu-prod.asyncgw.teams.microsoft.com/v1/objects/a/views/transcript "
            "https://eu-prod.asyncgw.teams.microsoft.com/v1/objects/a/views/video "
            "https://contoso.sharepoint.com/recording.mp4"
        )
        urls = mod._extract_urls(content)
        assert len(urls["transcripts"]) == 1
        assert len(urls["videos"]) == 1
        assert len(urls["sharepoint"]) == 1

    def test_no_urls(self):
        urls = mod._extract_urls("No URLs here")
        assert urls == {"transcripts": [], "videos": [], "sharepoint": []}


class TestGetTranscript:
    @responses.activate
    def test_parse_vtt(self):
        vtt_content = """WEBVTT

00:00:00.000 --> 00:00:05.000
<v Alice>Hello everyone, welcome to the meeting.</v>

00:00:05.000 --> 00:00:10.000
<v Alice>Let's start with the agenda.</v>

00:00:10.000 --> 00:00:15.000
<v Bob>Sounds good, thanks Alice.</v>
"""
        responses.get(
            url="https://teams.example.com/transcript",
            body=vtt_content,
            status=200,
        )
        result = mod.get_transcript("token", "https://teams.example.com/transcript")
        assert len(result["segments"]) == 2  # Alice lines merged, then Bob
        assert result["segments"][0]["speaker"] == "Alice"
        assert "Hello everyone" in result["segments"][0]["text"]
        assert "agenda" in result["segments"][0]["text"]  # merged
        assert result["segments"][1]["speaker"] == "Bob"

    @responses.activate
    def test_parse_vtt_with_html_entities(self):
        vtt_content = """WEBVTT

00:00:00.000 --> 00:00:05.000
<v Speaker>We need to check A &amp; B &lt;important&gt;</v>
"""
        responses.get(
            url="https://teams.example.com/transcript",
            body=vtt_content,
            status=200,
        )
        result = mod.get_transcript("token", "https://teams.example.com/transcript")
        assert "A & B" in result["segments"][0]["text"]

    @responses.activate
    def test_empty_vtt(self):
        responses.get(
            url="https://teams.example.com/transcript",
            body="WEBVTT\n\n",
            status=200,
        )
        result = mod.get_transcript("token", "https://teams.example.com/transcript")
        assert result["segments"] == []


class TestGetRecordings:
    @responses.activate
    def test_filters_recording_messages(self):
        responses.get(
            url=re.compile(r"https?://.*"),
            json={
                "messages": [
                    {
                        "id": "1",
                        "composetime": "2024-01-15T10:00:00Z",
                        "imdisplayname": "Teams",
                        "messagetype": "RichText/Media_CallRecording",
                        "content": '<a href="https://eu-prod.asyncgw.teams.microsoft.com/v1/objects/abc/views/transcript">Transcript</a>',
                    },
                    {
                        "id": "2",
                        "composetime": "2024-01-15T10:01:00Z",
                        "imdisplayname": "John",
                        "messagetype": "Text",
                        "content": "Normal message",
                    },
                ]
            },
            status=200,
        )
        result = mod.get_recordings("token", "conv1")
        assert result["count"] == 1
        assert result["recordings"][0]["id"] == "1"
        assert len(result["recordings"][0]["transcriptUrls"]) == 1
