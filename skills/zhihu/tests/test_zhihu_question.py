"""Tests for zhihu/scripts/zhihu_question.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("zhihu", "zhihu_question")

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
            url=re.compile(r"https://www\.zhihu\.com/api/v4/questions/12345/answers"),
            json={"data": []},
            status=200,
        )
        result = mod.get_question("12345")
        assert result["question"]["id"] == 12345
        assert result["question"]["title"] == ""
        assert result["answers"]["count"] == 0
        assert result["answers"]["items"] == []

    @responses.activate
    def test_question_sort_by_created(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/questions/12345/answers"),
            json={"data": [SAMPLE_ANSWER]},
            status=200,
        )
        result = mod.get_question("12345", sort="created")
        assert result["answers"]["count"] == 1
