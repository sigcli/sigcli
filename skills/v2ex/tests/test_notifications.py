"""Tests for v2ex/scripts/v2ex_notifications.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("v2ex", "v2ex_notifications")


NOTIFICATIONS_HTML = """
<html><body>
<div class="cell" id="n_10001">
    <a href="/member/alice">alice</a> replied to your topic
    <a href="/t/12345#reply50">How to learn Rust?</a>
    <span class="payload">I recommend the official Rust book.</span>
    <span class="snow">2 hours ago</span>
</div>
<div class="cell" id="n_10002">
    <a href="/member/bob">bob</a> thanked your topic
    <a href="/t/12346">Best VSCode extensions</a>
    <span class="payload">Thanks for sharing!</span>
    <span class="snow">3 hours ago</span>
</div>
</body></html>
"""


class TestGetNotifications:
    @responses.activate
    def test_parse_notifications(self):
        responses.get(
            url=re.compile(r"https://www\.v2ex\.com/notifications"),
            body=NOTIFICATIONS_HTML,
            status=200,
        )
        result = mod.get_notifications("fakecookie", page=1)
        assert result["count"] == 2
        assert result["page"] == 1
        n1 = result["notifications"][0]
        assert n1["id"] == 10001
        assert n1["from_member"] == "alice"
        assert n1["topic_id"] == 12345
        n2 = result["notifications"][1]
        assert n2["id"] == 10002
        assert n2["from_member"] == "bob"

    def test_requires_cookie(self):
        from v2ex_client import V2exError

        try:
            mod.get_notifications("", page=1)
            assert False, "Should have raised V2exError"
        except V2exError as e:
            assert e.code == "AUTH_REQUIRED"
