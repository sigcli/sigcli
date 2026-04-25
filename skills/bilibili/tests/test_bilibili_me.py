"""Tests for bilibili/scripts/bilibili_me.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_me")
client_mod = load_script("bilibili", "bilibili_client")

FAKE_COOKIE = "SESSDATA=fakesession; bili_jct=fakecsrf"

_NAV_RESPONSE = {
    "code": 0,
    "data": {
        "mid": 12345678,
        "uname": "TestBiliUser",
        "face": "https://i0.hdslb.com/bfs/face/test.jpg",
        "level_info": {"current_level": 5},
        "money": 233.0,
        "vipType": 2,
        "vip": {"label": {"text": "年度大会员"}},
        "isLogin": True,
        "email_verified": 1,
        "mobile_verified": 1,
        "wbi_img": {"img_url": "https://i0.hdslb.com/bfs/wbi/abc.png", "sub_url": "https://i0.hdslb.com/bfs/wbi/def.png"},
    },
}


@responses.activate
def test_get_me():
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/nav"), json=_NAV_RESPONSE, status=200)
    client = client_mod.BilibiliClient(FAKE_COOKIE)
    result = mod.get_me(client)
    assert result["mid"] == 12345678
    assert result["name"] == "TestBiliUser"
    assert result["level"] == 5
    assert result["coins"] == 233.0
    assert result["is_login"] is True


@responses.activate
def test_get_me_not_logged_in():
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/nav"), json={"code": -101, "message": "账号未登录"}, status=200)
    client = client_mod.BilibiliClient(FAKE_COOKIE)
    try:
        mod.get_me(client)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "API_ERROR"


def test_get_me_requires_auth():
    client = client_mod.BilibiliClient("")
    try:
        mod.get_me(client)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "AUTH_REQUIRED"
