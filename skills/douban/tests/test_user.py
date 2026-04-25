"""Tests for douban/scripts/douban_user.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("douban", "douban_user")

SAMPLE_USER = {
    "id": "1000001",
    "name": "阿北",
    "uid": "ahbei",
    "avatar": "https://img.doubanio.com/icon/u1000001.jpg",
    "intro": "豆瓣创始人",
    "url": "https://www.douban.com/people/ahbei/",
}


class TestGetUser:
    @responses.activate
    def test_user_profile(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/user/ahbei"),
            json=SAMPLE_USER,
            status=200,
        )
        result = mod.get_user("ahbei")
        user = result["user"]
        assert user["id"] == "1000001"
        assert user["name"] == "阿北"
        assert user["uid"] == "ahbei"
        assert user["intro"] == "豆瓣创始人"

    @responses.activate
    def test_user_numeric_id(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/user/1000001"),
            json=SAMPLE_USER,
            status=200,
        )
        result = mod.get_user("1000001")
        assert result["user"]["name"] == "阿北"

    @responses.activate
    def test_user_empty_fields(self):
        user_data = {"id": "2", "name": "", "uid": "empty", "avatar": "", "intro": "", "url": ""}
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/user/empty"),
            json=user_data,
            status=200,
        )
        result = mod.get_user("empty")
        assert result["user"]["id"] == "2"
        assert result["user"]["name"] == ""
