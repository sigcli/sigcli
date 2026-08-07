"""Tests for douban/scripts/douban_music.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("douban", "douban_music")

SAMPLE_MUSIC = {
    "id": "1401853",
    "title": "范特西",
    "rating": {"value": 9.2, "count": 120000},
    "intro": "周杰伦的第二张专辑。",
    "pic": {"normal": "https://img.doubanio.com/small.jpg", "large": "https://img.doubanio.com/large.jpg"},
    "url": "https://music.douban.com/subject/1401853/",
    "attrs": {"singer": ["周杰伦"], "publisher": ["BMG"]},
}


class TestGetMusic:
    @responses.activate
    def test_music_detail(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/music/1401853"),
            json=SAMPLE_MUSIC,
            status=200,
        )
        result = mod.get_music("1401853")
        music = result["music"]
        assert music["id"] == "1401853"
        assert music["title"] == "范特西"
        assert music["rating"] == 9.2
        assert music["singer"] == ["周杰伦"]
        assert music["publisher"] == ["BMG"]

    @responses.activate
    def test_music_missing_attrs(self):
        music_data = {**SAMPLE_MUSIC, "attrs": None}
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/music/999"),
            json=music_data,
            status=200,
        )
        result = mod.get_music("999")
        music = result["music"]
        assert music["singer"] == []
        assert music["publisher"] == []
