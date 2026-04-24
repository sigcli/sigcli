"""Tests for zhihu/scripts/zhihu_question.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("zhihu", "zhihu_question")

SAMPLE_QUESTION = {
    "id": 12345,
    "type": "question",
    "title": "如何学习编程？",
    "detail": "想开始学编程，不知道从哪里入手。",
    "answer_count": 42,
    "comment_count": 5,
    "follower_count": 1200,
    "created": 1714000000,
    "updated_time": 1714003600,
    "url": "https://www.zhihu.com/question/12345",
    "author": {"name": "张三", "url_token": "zhang-san", "avatar_url": "https://pic.zhimg.com/v2-abc.jpg", "headline": "程序员"},
}

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


class TestGetQuestion:
    @responses.activate
    def test_question_with_answers(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/questions/12345$"),
            json=SAMPLE_QUESTION,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/questions/12345/answers"),
            json={"data": [SAMPLE_ANSWER]},
            status=200,
        )
        result = mod.get_question("12345")
        assert result["question"]["id"] == 12345
        assert result["question"]["title"] == "如何学习编程？"
        assert result["answers"]["count"] == 1
        assert result["answers"]["items"][0]["voteup_count"] == 500

    @responses.activate
    def test_question_no_answers(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/questions/12345$"),
            json=SAMPLE_QUESTION,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/questions/12345/answers"),
            json={"data": []},
            status=200,
        )
        result = mod.get_question("12345")
        assert result["question"]["title"] == "如何学习编程？"
        assert result["answers"]["count"] == 0
        assert result["answers"]["items"] == []

    @responses.activate
    def test_question_sort_by_created(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/questions/12345$"),
            json=SAMPLE_QUESTION,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/questions/12345/answers"),
            json={"data": [SAMPLE_ANSWER]},
            status=200,
        )
        result = mod.get_question("12345", sort="created")
        assert result["answers"]["count"] == 1
