"""Tests for zhihu/scripts/zhihu_answer.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("zhihu", "zhihu_answer")

SAMPLE_ANSWER = {
    "id": 67890,
    "type": "answer",
    "question": {"id": 12345, "title": "如何学习编程？"},
    "author": {"name": "李四", "url_token": "li-si", "avatar_url": "https://pic.zhimg.com/v2-def.jpg", "headline": "资深工程师"},
    "content": "<p>建议从 Python 开始学起...</p>",
    "excerpt": "建议从 Python 开始学起...",
    "voteup_count": 500,
    "comment_count": 20,
    "created_time": 1714001000,
    "updated_time": 1714002000,
}


class TestGetAnswer:
    @responses.activate
    def test_answer_detail(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/answers/67890"),
            json=SAMPLE_ANSWER,
            status=200,
        )
        result = mod.get_answer("67890")
        a = result["answer"]
        assert a["id"] == 67890
        assert a["voteup_count"] == 500
        assert a["author"]["name"] == "李四"
        assert a["question"]["id"] == 12345

    @responses.activate
    def test_answer_with_cookie(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/answers/67890"),
            json=SAMPLE_ANSWER,
            status=200,
        )
        result = mod.get_answer("67890", cookie="fakecookie")
        assert result["answer"]["id"] == 67890
