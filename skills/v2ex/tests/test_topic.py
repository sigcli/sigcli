"""Tests for v2ex/scripts/v2ex_topic.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_topic")

SAMPLE_TOPIC = {
    "id": 100001,
    "title": "Test topic",
    "url": "https://www.v2ex.com/t/100001",
    "content": "Hello world",
    "replies": 2,
    "created": 1714000000,
    "node": {"id": 90, "name": "python", "title": "Python"},
    "member": {"id": 1234, "username": "testuser", "avatar_normal": "https://cdn.v2ex.com/a.png"},
}

SAMPLE_REPLY = {
    "id": 500001,
    "topic_id": 100001,
    "content": "Great post!",
    "content_rendered": "<p>Great post!</p>",
    "created": 1714001000,
    "member": {"id": 5678, "username": "replier", "avatar_normal": "https://cdn.v2ex.com/b.png"},
}


class TestGetTopicV1:
    @responses.activate
    def test_topic_with_replies(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/topics/show\.json"),
            json=[SAMPLE_TOPIC],
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/replies/show\.json"),
            json=[SAMPLE_REPLY],
            status=200,
        )
        result = mod.get_topic("100001", page=1, cookie="")
        assert result["topic"]["id"] == 100001
        assert result["replies"]["count"] == 1
        assert result["replies"]["items"][0]["content"] == "Great post!"

    @responses.activate
    def test_topic_no_replies(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/topics/show\.json"),
            json=[SAMPLE_TOPIC],
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/api/replies/show\.json"),
            json=[],
            status=200,
        )
        result = mod.get_topic("100001", page=1, cookie="")
        assert result["replies"]["count"] == 0


class TestGetTopicWithCookie:
    @responses.activate
    def test_topic_html_parsing(self):
        html = """
        <html><body>
        <div class="header"><h1>Test Topic Title</h1><small class="gray">by testuser</small></div>
        <div class="topic_content"><p>Hello world content</p></div>
        <div class="cell" id="r_500001">
            <strong><a class="dark" href="/member/replier">replier</a></strong>
            <div class="reply_content"><p>Nice post!</p></div>
            <span class="no">1</span>
            <span class="ago">2 hours ago</span>
        </div>
        </body></html>
        """
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/t/100001"),
            body=html,
            status=200,
        )
        result = mod.get_topic("100001", page=1, cookie="fakecookie")
        assert result["topic"]["title"] == "Test Topic Title"
        assert result["replies"]["count"] == 1
        assert result["replies"]["items"][0]["member"] == "replier"
        assert result["replies"]["items"][0]["floor"] == "1"
