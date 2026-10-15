"""Tests for douban/scripts/douban_top250.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("douban", "douban_top250")

SAMPLE_HTML = """
<html>
<body>
<ol class="grid_view">
  <li>
    <div class="item">
      <div class="pic">
        <em>1</em>
      </div>
      <div class="info">
        <div class="hd">
          <a href="https://movie.douban.com/subject/1292052/">
            <span class="title">肖申克的救赎</span>
          </a>
        </div>
        <div class="bd">
          <p>导演: 弗兰克·德拉邦特 主演: 蒂姆·罗宾斯 / 摩根·弗里曼 1994 / 美国 / 犯罪 剧情</p>
          <div class="star">
            <span class="rating_num">9.7</span>
          </div>
          <p class="quote"><span class="inq">希望让人自由。</span></p>
        </div>
      </div>
    </div>
  </li>
  <li>
    <div class="item">
      <div class="pic">
        <em>2</em>
      </div>
      <div class="info">
        <div class="hd">
          <a href="https://movie.douban.com/subject/1291546/">
            <span class="title">霸王别姬</span>
          </a>
        </div>
        <div class="bd">
          <p>导演: 陈凯歌 主演: 张国荣 / 张丰毅 1993 / 中国大陆 / 剧情 爱情</p>
          <div class="star">
            <span class="rating_num">9.6</span>
          </div>
          <p class="quote"><span class="inq">风华绝代。</span></p>
        </div>
      </div>
    </div>
  </li>
</ol>
</body>
</html>
"""


class TestGetTop250:
    @responses.activate
    def test_top250_page1(self):
        responses.get(
            url=re.compile(r"https://movie\.douban\.com/top250"),
            body=SAMPLE_HTML,
            status=200,
        )
        result = mod.get_top250(page=1)
        assert result["page"] == 1
        assert result["count"] == 2
        first = result["movies"][0]
        assert first["rank"] == 1
        assert first["title"] == "肖申克的救赎"
        assert first["rating"] == 9.7
        assert first["quote"] == "希望让人自由。"
        assert "1292052" in first["url"]
        second = result["movies"][1]
        assert second["rank"] == 2
        assert second["title"] == "霸王别姬"
        assert second["rating"] == 9.6

    @responses.activate
    def test_top250_empty_page(self):
        responses.get(
            url=re.compile(r"https://movie\.douban\.com/top250"),
            body="<html><body><ol class='grid_view'></ol></body></html>",
            status=200,
        )
        result = mod.get_top250(page=10)
        assert result["page"] == 10
        assert result["count"] == 0
        assert result["movies"] == []

    @responses.activate
    def test_top250_page_offset(self):
        responses.get(
            url=re.compile(r"https://movie\.douban\.com/top250"),
            body=SAMPLE_HTML,
            status=200,
        )
        mod.get_top250(page=3)
        assert "start=50" in responses.calls[0].request.url
