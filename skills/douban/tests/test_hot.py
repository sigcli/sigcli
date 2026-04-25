"""Tests for douban/scripts/douban_hot.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("douban", "douban_hot")

SAMPLE_MOVIE = {
    "id": "35267208",
    "title": "流浪地球2",
    "original_title": "The Wandering Earth II",
    "year": "2023",
    "rating": {"value": 8.3, "count": 800000},
    "genres": ["科幻", "冒险"],
    "directors": [{"name": "郭帆"}],
    "actors": [{"name": "吴京"}, {"name": "刘德华"}],
    "intro": "太阳即将毁灭...",
    "pic": {"normal": "https://img.doubanio.com/small.jpg", "large": "https://img.doubanio.com/large.jpg"},
    "url": "https://movie.douban.com/subject/35267208/",
    "card_subtitle": "2023 / 中国大陆 / 科幻 冒险",
}


class TestGetHot:
    @responses.activate
    def test_hot_movies(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/movie/hot_gird"),
            json={"items": [SAMPLE_MOVIE]},
            status=200,
        )
        result = mod.get_hot(category="hot", limit=10)
        assert result["category"] == "hot"
        assert result["count"] == 1
        movie = result["movies"][0]
        assert movie["id"] == "35267208"
        assert movie["title"] == "流浪地球2"

    @responses.activate
    def test_showing_movies(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/movie/movie_showing"),
            json={"items": [SAMPLE_MOVIE]},
            status=200,
        )
        result = mod.get_hot(category="showing")
        assert result["category"] == "showing"
        assert result["count"] == 1

    @responses.activate
    def test_coming_movies(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/movie/movie_soon"),
            json={"subject_collection_items": [SAMPLE_MOVIE]},
            status=200,
        )
        result = mod.get_hot(category="coming")
        assert result["category"] == "coming"
        assert result["count"] == 1

    @responses.activate
    def test_empty_result(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/movie/hot_gird"),
            json={"items": []},
            status=200,
        )
        result = mod.get_hot()
        assert result["count"] == 0
        assert result["movies"] == []
