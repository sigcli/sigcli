"""Tests for douban/scripts/douban_client.py"""

from test_helpers import load_script

mod = load_script("douban", "douban_client")


class TestParseMovie:
    def test_parse_full_movie(self):
        raw = {
            "id": "1292052",
            "title": "肖申克的救赎",
            "original_title": "The Shawshank Redemption",
            "year": "1994",
            "rating": {"value": 9.7, "count": 2500000},
            "genres": ["剧情", "犯罪"],
            "directors": [{"name": "弗兰克·德拉邦特"}],
            "actors": [{"name": "蒂姆·罗宾斯"}],
            "intro": "一场冤狱引出了一段传奇。",
            "pic": {"normal": "https://img.doubanio.com/small.jpg", "large": "https://img.doubanio.com/large.jpg"},
            "url": "https://movie.douban.com/subject/1292052/",
            "card_subtitle": "1994 / 美国",
        }
        result = mod.parse_movie(raw)
        assert result["id"] == "1292052"
        assert result["title"] == "肖申克的救赎"
        assert result["rating"] == 9.7
        assert result["directors"] == ["弗兰克·德拉邦特"]
        assert result["cover"] == "https://img.doubanio.com/large.jpg"

    def test_parse_none(self):
        assert mod.parse_movie(None) is None

    def test_parse_missing_fields(self):
        result = mod.parse_movie({"id": "1"})
        assert result["id"] == "1"
        assert result["title"] == ""
        assert result["rating"] == 0
        assert result["directors"] == []


class TestParseBook:
    def test_parse_full_book(self):
        raw = {
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
        result = mod.parse_book(raw)
        assert result["id"] == "2567698"
        assert result["author"] == ["刘慈欣"]
        assert result["rating"] == 8.8

    def test_parse_none(self):
        assert mod.parse_book(None) is None


class TestParseMusic:
    def test_parse_full_music(self):
        raw = {
            "id": "1401853",
            "title": "范特西",
            "rating": {"value": 9.2, "count": 120000},
            "intro": "周杰伦的第二张专辑。",
            "pic": {"normal": "https://img.doubanio.com/small.jpg", "large": "https://img.doubanio.com/large.jpg"},
            "url": "https://music.douban.com/subject/1401853/",
            "attrs": {"singer": ["周杰伦"], "publisher": ["BMG"]},
        }
        result = mod.parse_music(raw)
        assert result["id"] == "1401853"
        assert result["singer"] == ["周杰伦"]
        assert result["rating"] == 9.2

    def test_parse_none(self):
        assert mod.parse_music(None) is None


class TestParseUser:
    def test_parse_full_user(self):
        raw = {"id": "1000001", "name": "阿北", "uid": "ahbei", "avatar": "https://img.doubanio.com/icon.jpg", "intro": "豆瓣创始人", "url": "https://www.douban.com/people/ahbei/"}
        result = mod.parse_user(raw)
        assert result["name"] == "阿北"
        assert result["uid"] == "ahbei"

    def test_parse_none(self):
        assert mod.parse_user(None) is None


class TestParseInterest:
    def test_parse_interest(self):
        raw = {"rating": {"value": 5}, "comment": "好看", "create_time": "2026-01-01", "user": {"name": "fan"}, "useful_count": 3}
        result = mod.parse_interest(raw)
        assert result["rating"] == 5
        assert result["comment"] == "好看"
        assert result["user"] == "fan"

    def test_parse_none(self):
        assert mod.parse_interest(None) is None


class TestParseTop250Page:
    def test_parse_html(self):
        html = """
        <html><body>
        <ol class="grid_view">
          <li>
            <div class="item">
              <div class="pic"><em>1</em></div>
              <div class="info">
                <div class="hd"><a href="https://movie.douban.com/subject/1292052/"><span class="title">肖申克的救赎</span></a></div>
                <div class="bd">
                  <p>1994 / 美国 / 犯罪 剧情</p>
                  <div class="star"><span class="rating_num">9.7</span></div>
                  <p class="quote"><span class="inq">希望让人自由。</span></p>
                </div>
              </div>
            </div>
          </li>
        </ol>
        </body></html>
        """
        movies = mod.parse_top250_page(html)
        assert len(movies) == 1
        assert movies[0]["rank"] == 1
        assert movies[0]["title"] == "肖申克的救赎"
        assert movies[0]["rating"] == 9.7
        assert movies[0]["quote"] == "希望让人自由。"

    def test_parse_empty_html(self):
        html = "<html><body><ol class='grid_view'></ol></body></html>"
        movies = mod.parse_top250_page(html)
        assert movies == []
