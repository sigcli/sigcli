"""Shared Douban client -- Frodo API helpers, HTML scraping, and item parsers."""

import requests
from bs4 import BeautifulSoup

FRODO_BASE = "https://frodo.douban.com/api/v2"
DOUBAN_BASE = "https://www.douban.com"
MOVIE_DOUBAN_BASE = "https://movie.douban.com"

FRODO_APIKEY = "0ac44ae016490db2204ce0a042db2916"

MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) MicroMessenger/8.0.0"

TIMEOUT = 15


class DoubanClient:
    def __init__(self):
        self._session = requests.Session()
        self._session.headers["User-Agent"] = MOBILE_UA

    def frodo_get(self, path, params=None):
        params = params or {}
        params["apikey"] = FRODO_APIKEY
        resp = self._session.get(FRODO_BASE + path, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    def html_get(self, url, params=None):
        resp = self._session.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.text


def parse_movie(m):
    """Normalize a Frodo movie object to a consistent dict."""
    if not m:
        return None
    rating = m.get("rating") or {}
    directors = [d.get("name", "") for d in (m.get("directors") or [])]
    actors = [a.get("name", "") for a in (m.get("actors") or [])]
    pic = m.get("pic") or {}
    return {
        "id": m.get("id"),
        "title": m.get("title", ""),
        "original_title": m.get("original_title", ""),
        "year": m.get("year", ""),
        "rating": rating.get("value", 0),
        "rating_count": rating.get("count", 0),
        "genres": m.get("genres", []),
        "directors": directors,
        "actors": actors,
        "intro": (m.get("intro") or "")[:500],
        "cover": pic.get("large") or pic.get("normal", ""),
        "url": m.get("url", ""),
        "card_subtitle": m.get("card_subtitle", ""),
    }


def parse_book(b):
    """Normalize a Frodo book object to a consistent dict."""
    if not b:
        return None
    rating = b.get("rating") or {}
    pic = b.get("pic") or {}
    return {
        "id": b.get("id"),
        "title": b.get("title", ""),
        "subtitle": b.get("subtitle", ""),
        "author": b.get("author", []),
        "publisher": b.get("publisher", ""),
        "pubdate": b.get("pubdate", ""),
        "pages": b.get("pages", ""),
        "rating": rating.get("value", 0),
        "rating_count": rating.get("count", 0),
        "intro": (b.get("intro") or "")[:500],
        "cover": pic.get("large") or pic.get("normal", "") if isinstance(pic, dict) else str(pic),
        "url": b.get("url", ""),
    }


def parse_music(m):
    """Normalize a Frodo music object to a consistent dict."""
    if not m:
        return None
    rating = m.get("rating") or {}
    pic = m.get("pic") or {}
    attrs = m.get("attrs") or {}
    return {
        "id": m.get("id"),
        "title": m.get("title", ""),
        "rating": rating.get("value", 0),
        "rating_count": rating.get("count", 0),
        "intro": (m.get("intro") or "")[:500],
        "cover": pic.get("large") or pic.get("normal", "") if isinstance(pic, dict) else str(pic),
        "url": m.get("url", ""),
        "singer": attrs.get("singer", []),
        "publisher": attrs.get("publisher", []),
    }


def parse_user(u):
    """Normalize a Frodo user object to a consistent dict."""
    if not u:
        return None
    return {
        "id": u.get("id", ""),
        "name": u.get("name", ""),
        "uid": u.get("uid", ""),
        "avatar": u.get("avatar", ""),
        "intro": u.get("intro", ""),
        "url": u.get("url", ""),
    }


def parse_interest(i):
    """Normalize a Frodo interest (review/rating) to a consistent dict."""
    if not i:
        return None
    rating = i.get("rating") or {}
    user = i.get("user") or {}
    return {
        "rating": rating.get("value", 0),
        "comment": i.get("comment", ""),
        "create_time": i.get("create_time", ""),
        "user": user.get("name", ""),
        "useful_count": i.get("useful_count", 0),
    }


def parse_top250_page(html):
    """Parse the Top 250 HTML page and extract movie entries."""
    soup = BeautifulSoup(html, "html.parser")
    movies = []
    for idx, item in enumerate(soup.select("ol.grid_view li")):
        movie = {}
        em = item.select_one("div.hd span.title")
        if em:
            movie["title"] = em.get_text(strip=True)
        num = item.select_one("div.pic em")
        if num:
            movie["rank"] = int(num.get_text(strip=True))
        rating_num = item.select_one("span.rating_num")
        if rating_num:
            try:
                movie["rating"] = float(rating_num.get_text(strip=True))
            except ValueError:
                movie["rating"] = 0.0
        info_el = item.select_one("div.bd p")
        if info_el:
            movie["info"] = info_el.get_text(separator=" ", strip=True)
        quote_el = item.select_one("span.inq")
        if quote_el:
            movie["quote"] = quote_el.get_text(strip=True)
        link = item.select_one("div.hd a")
        if link:
            movie["url"] = link.get("href", "")
        movies.append(movie)
    return movies
