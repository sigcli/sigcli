"""Tests for douban/scripts/douban_book.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("douban", "douban_book")

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

SAMPLE_INTEREST = {
    "rating": {"value": 5},
    "comment": "科幻巨作",
    "create_time": "2026-02-15 12:00:00",
    "user": {"name": "bookworm"},
    "useful_count": 10,
}


class TestGetBook:
    @responses.activate
    def test_book_detail(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/book/2567698"),
            json=SAMPLE_BOOK,
            status=200,
        )
        result = mod.get_book("2567698")
        book = result["book"]
        assert book["id"] == "2567698"
        assert book["title"] == "三体"
        assert book["author"] == ["刘慈欣"]
        assert book["rating"] == 8.8
        assert book["publisher"] == "重庆出版社"
        assert "reviews" not in result

    @responses.activate
    def test_book_with_reviews(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/book/2567698\b(?!/)"),
            json=SAMPLE_BOOK,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/book/2567698/interests"),
            json={"interests": [SAMPLE_INTEREST]},
            status=200,
        )
        result = mod.get_book("2567698", include_reviews=True)
        assert result["book"]["title"] == "三体"
        assert len(result["reviews"]) == 1
        assert result["reviews"][0]["comment"] == "科幻巨作"

    @responses.activate
    def test_book_empty_reviews(self):
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/book/999\b(?!/)"),
            json=SAMPLE_BOOK,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://frodo\.douban\.com/api/v2/book/999/interests"),
            json={"interests": []},
            status=200,
        )
        result = mod.get_book("999", include_reviews=True)
        assert result["reviews"] == []
