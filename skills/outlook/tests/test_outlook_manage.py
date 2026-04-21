"""Tests for outlook/scripts/outlook_manage.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("outlook", "outlook_manage")


class TestManageMessage:
    @responses.activate
    def test_mark_read(self):
        responses.patch(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/msg1"),
            json={"id": "msg1", "isRead": True},
            status=200,
        )
        result = mod.manage_message("token", "msg1", "read")
        assert result["success"] is True
        assert result["action"] == "read"

    @responses.activate
    def test_mark_unread(self):
        responses.patch(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/msg1"),
            json={"id": "msg1", "isRead": False},
            status=200,
        )
        result = mod.manage_message("token", "msg1", "unread")
        assert result["success"] is True
        assert result["action"] == "unread"

    @responses.activate
    def test_flag(self):
        responses.patch(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={},
            status=200,
        )
        result = mod.manage_message("token", "msg1", "flag")
        assert result["success"] is True
        assert result["action"] == "flag"

    @responses.activate
    def test_unflag(self):
        responses.patch(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={},
            status=200,
        )
        result = mod.manage_message("token", "msg1", "unflag")
        assert result["success"] is True

    @responses.activate
    def test_move(self):
        responses.post(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/msg1/move"),
            json={"id": "msg1"},
            status=200,
        )
        result = mod.manage_message("token", "msg1", "move", folder="Archive")
        assert result["success"] is True
        assert result["action"] == "move"

    def test_move_without_folder(self):
        result = mod.manage_message("token", "msg1", "move")
        assert result["error"] == "MISSING_ARGS"

    @responses.activate
    def test_delete(self):
        responses.delete(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/msg1"),
            status=204,
        )
        result = mod.manage_message("token", "msg1", "delete")
        assert result["success"] is True
        assert result["action"] == "delete"

    def test_invalid_action(self):
        result = mod.manage_message("token", "msg1", "unknown")
        assert result["error"] == "INVALID_ACTION"
