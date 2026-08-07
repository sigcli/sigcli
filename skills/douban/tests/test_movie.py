"""Tests for douban/scripts/douban_movie.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("douban", "douban_movie")

SAMPLE_MOVIE = {
    "id": "1292052",
    "title": "肖申克的救赎",
    "original_title": "The Shawshank Redemption",
    "year": "1994",
    "rating": {"value": 9.7, "count": 2500000},
    "genres": ["剧情", "犯罪"],
    "directors": [{"name": "弗兰克·德拉邦特"}],
    "actors": [{"name": "蒂姆·罗宾斯"}, {"name": "摩根·弗里曼"}],
    "intro": "一场冤狱引出了一段传奇。",
    "pic": {"normal": "https://img.doubanio.com/small.jpg", "large": "https://img.doubanio.com/large.jpg"},
    "url": "https://movie.douban.com/subject/1292052/",
    "card_subtitle": "1994 / 美国 / 剧情 犯罪",
}

SAMPLE_INTEREST = {
    "rating": {"value": 5},
    "comment": "经典之作，百看不厌",
    "create_time": "2026-01-01 10:00:00",
    "user": {"name": "filmfan"},
    "useful_count": 42,
}


class TestGetMovie:
    @responses.activate
    def test_movie_detail(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/movie/1292052"),
            json=SAMPLE_MOVIE,
            status=200,
        )
        result = mod.get_movie("1292052")
        movie = result["movie"]
        assert movie["id"] == "1292052"
        assert movie["title"] == "肖申克的救赎"
        assert movie["year"] == "1994"
        assert movie["rating"] == 9.7
        assert movie["directors"] == ["弗兰克·德拉邦特"]
        assert movie["actors"] == ["蒂姆·罗宾斯", "摩根·弗里曼"]
        assert "reviews" not in result

    @responses.activate
    def test_movie_with_reviews(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/movie/1292052\b(?!/)"),
            json=SAMPLE_MOVIE,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/movie/1292052/interests"),
            json={"interests": [SAMPLE_INTEREST]},
            status=200,
        )
        result = mod.get_movie("1292052", include_reviews=True)
        assert result["movie"]["title"] == "肖申克的救赎"
        assert len(result["reviews"]) == 1
        review = result["reviews"][0]
        assert review["comment"] == "经典之作，百看不厌"
        assert review["user"] == "filmfan"
        assert review["rating"] == 5

    @responses.activate
    def test_movie_no_reviews_data(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/movie/999\b(?!/)"),
            json=SAMPLE_MOVIE,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/movie/999/interests"),
            json={"interests": []},
            status=200,
        )
        result = mod.get_movie("999", include_reviews=True)
        assert result["reviews"] == []
