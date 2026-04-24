"""Tests for zhihu/scripts/zhihu_member.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("zhihu", "zhihu_member")

SAMPLE_MEMBER = {
    "id": "abc123",
    "name": "张三",
    "url_token": "zhang-san",
    "avatar_url": "https://pic.zhimg.com/v2-abc.jpg",
    "headline": "程序员",
    "description": "热爱编程",
    "gender": 1,
    "follower_count": 5000,
    "following_count": 200,
    "answer_count": 150,
    "articles_count": 30,
    "voteup_count": 12000,
}

SAMPLE_ANSWER = {
    "id": 67890,
    "type": "answer",
    "question": {"id": 12345, "title": "如何学习编程？"},
    "author": {"name": "张三", "url_token": "zhang-san", "avatar_url": "https://pic.zhimg.com/v2-abc.jpg", "headline": "程序员"},
    "content": "<p>建议从 Python 开始...</p>",
    "excerpt": "建议从 Python 开始...",
    "voteup_count": 500,
    "comment_count": 20,
    "created_time": 1714001000,
    "updated_time": 1714002000,
}


class TestGetMember:
    @responses.activate
    def test_profile_only(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/members/zhang-san$"),
            json=SAMPLE_MEMBER,
            status=200,
        )
        result = mod.get_member("zhang-san")
        m = result["member"]
        assert m["name"] == "张三"
        assert m["url_token"] == "zhang-san"
        assert m["follower_count"] == 5000
        assert "answers" not in result

    @responses.activate
    def test_profile_with_answers(self):
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/members/zhang-san$"),
            json=SAMPLE_MEMBER,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.zhihu\.com/api/v4/members/zhang-san/answers"),
            json={"data": [SAMPLE_ANSWER]},
            status=200,
        )
        result = mod.get_member("zhang-san", include_answers=True)
        assert result["member"]["name"] == "张三"
        assert len(result["answers"]) == 1
        assert result["answers"][0]["voteup_count"] == 500
