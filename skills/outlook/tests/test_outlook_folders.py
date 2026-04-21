"""Tests for outlook/scripts/outlook_folders.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("outlook", "outlook_folders")


class TestListFolders:
    @responses.activate
    def test_list_folders(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*mailFolders"),
            json={
                "value": [
                    {
                        "id": "folder1",
                        "displayName": "Inbox",
                        "totalItemCount": 100,
                        "unreadItemCount": 5,
                        "childFolderCount": 2,
                    },
                    {
                        "id": "folder2",
                        "displayName": "Sent Items",
                        "totalItemCount": 50,
                        "unreadItemCount": 0,
                        "childFolderCount": 0,
                    },
                ]
            },
            status=200,
        )
        result = mod.list_folders("token")
        assert result["count"] == 2
        assert result["folders"][0]["displayName"] == "Inbox"
        assert result["folders"][0]["unreadItemCount"] == 5
        assert result["folders"][1]["displayName"] == "Sent Items"

    @responses.activate
    def test_list_folders_with_children(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/mailFolders\?"),
            json={
                "value": [
                    {
                        "id": "folder1",
                        "displayName": "Inbox",
                        "totalItemCount": 100,
                        "unreadItemCount": 5,
                        "childFolderCount": 1,
                    },
                ]
            },
            status=200,
        )
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/mailFolders/folder1/childFolders"),
            json={
                "value": [
                    {"id": "child1", "displayName": "Important", "totalItemCount": 10, "unreadItemCount": 2},
                ]
            },
            status=200,
        )
        result = mod.list_folders("token", include_children=True)
        assert result["count"] == 1
        assert len(result["folders"][0]["children"]) == 1
        assert result["folders"][0]["children"][0]["displayName"] == "Important"

    @responses.activate
    def test_empty_folders(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"value": []},
            status=200,
        )
        result = mod.list_folders("token")
        assert result["count"] == 0
        assert result["folders"] == []
