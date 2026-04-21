"""Tests for outlook/scripts/outlook_reply.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("outlook", "outlook_reply")


class TestCreateReplyDraft:
    @responses.activate
    def test_reply(self):
        responses.post(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/msg1/createReply"),
            json={"id": "reply1", "webLink": "https://outlook.office365.com/owa/?ItemID=reply1"},
            status=201,
        )
        responses.patch(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/reply1"),
            json={"id": "reply1", "webLink": "https://outlook.office365.com/owa/?ItemID=reply1"},
            status=200,
        )
        result = mod.create_reply_draft("token", "msg1", "reply", "Thanks!")
        assert result["success"] is True
        assert result["action"] == "reply"
        assert result["draftId"] == "reply1"
        assert result["originalMessageId"] == "msg1"

    @responses.activate
    def test_reply_all(self):
        responses.post(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/msg1/createReplyAll"),
            json={"id": "reply2", "webLink": ""},
            status=201,
        )
        responses.patch(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/reply2"),
            json={"id": "reply2", "webLink": ""},
            status=200,
        )
        result = mod.create_reply_draft("token", "msg1", "replyAll", "Noted")
        assert result["success"] is True
        assert result["action"] == "replyAll"

    @responses.activate
    def test_forward(self):
        responses.post(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/msg1/createForward"),
            json={"id": "fwd1", "webLink": ""},
            status=201,
        )
        responses.patch(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/fwd1"),
            json={"id": "fwd1", "webLink": ""},
            status=200,
        )
        result = mod.create_reply_draft("token", "msg1", "forward", "FYI", to="bob@example.com")
        assert result["success"] is True
        assert result["action"] == "forward"
        assert result["to"] == ["bob@example.com"]
