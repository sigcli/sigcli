"""Tests for douban/scripts/douban_search.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("douban", "douban_search")

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

SAMPLE_BOOK = {
    "id": "2567698",
    "title": "三体",
    "subtitle": "地球往事",
    "author": ["刘慈欣"],
    "publisher": "重庆出版社",
    "pubdate": "2008-1",
    "pages": "302",
    "rating": {"value": 8.8, "count": 500000},
    "intro": "文化大革命如火如荼进行的同时...",
    "pic": {"normal": "https://img.doubanio.com/small.jpg", "large": "https://img.doubanio.com/large.jpg"},
    "url": "https://book.douban.com/subject/2567698/",
}


class TestSearch:
    @responses.activate
    def test_search_movie(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/search"),
            json={
                "total": 1,
                "items": [{"target_type": "movie", "target": SAMPLE_MOVIE}],
            },
            status=200,
        )
        result = mod.search("肖申克的救赎", search_type="movie", limit=5)
        assert result["total"] == 1
        assert result["count"] == 1
        item = result["items"][0]
        assert item["id"] == "1292052"
        assert item["title"] == "肖申克的救赎"
        assert item["target_type"] == "movie"
        assert item["rating"] == 9.7

    @responses.activate
    def test_search_book(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/search"),
            json={
                "total": 1,
                "items": [{"target_type": "book", "target": SAMPLE_BOOK}],
            },
            status=200,
        )
        result = mod.search("三体", search_type="book")
        assert result["count"] == 1
        item = result["items"][0]
        assert item["title"] == "三体"
        assert item["target_type"] == "book"

    @responses.activate
    def test_search_empty(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/search"),
            json={"total": 0, "items": []},
            status=200,
        )
        result = mod.search("nonexistent_query_xyz")
        assert result["total"] == 0
        assert result["count"] == 0
        assert result["items"] == []

    @responses.activate
    def test_search_unknown_type_skipped(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/search"),
            json={
                "total": 1,
                "items": [{"target_type": "unknown", "target": {"id": "1"}}],
            },
            status=200,
        )
        result = mod.search("test")
        assert result["count"] == 0
        assert result["items"] == []
