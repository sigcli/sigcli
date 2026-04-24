"""Tests for v2ex/scripts/v2ex_daily.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_daily")


class TestDailyCheckin:
    @responses.activate
    def test_already_claimed(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/mission/daily"),
            body="<html><body>每日登录奖励已领取</body></html>",
            status=200,
        )
        result = mod.daily_checkin("fakecookie")
        assert result["success"] is True
        assert result["already_claimed"] is True

    @responses.activate
    def test_redeem_success(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/mission/daily$"),
            body='<html><body><a href="/mission/daily/redeem?once=12345">领取</a></body></html>',
            status=200,
        )
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/mission/daily/redeem"),
            body="<html><body>已成功领取每日登录奖励</body></html>",
            status=200,
        )
        result = mod.daily_checkin("fakecookie")
        assert result["success"] is True
        assert result["already_claimed"] is False

    def test_requires_cookie(self):
        from v2ex_client import V2exError

        try:
            mod.daily_checkin("")
            assert False, "Should have raised"
        except V2exError as e:
            assert e.code == "AUTH_REQUIRED"
