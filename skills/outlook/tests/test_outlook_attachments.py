"""Tests for outlook/scripts/outlook_attachments.py"""

import base64
import os
import re
import tempfile

import responses

from test_helpers import load_script

mod = load_script("outlook", "outlook_attachments")


class TestListAttachments:
    @responses.activate
    def test_list_attachments(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/msg1/attachments"),
            json={
                "value": [
                    {
                        "id": "att1",
                        "name": "report.pdf",
                        "contentType": "application/pdf",
                        "size": 12345,
                        "isInline": False,
                    },
                    {"id": "att2", "name": "image.png", "contentType": "image/png", "size": 5678, "isInline": True},
                ]
            },
            status=200,
        )
        result = mod.list_attachments("token", "msg1")
        assert result["count"] == 2
        assert result["messageId"] == "msg1"
        assert result["attachments"][0]["name"] == "report.pdf"
        assert result["attachments"][1]["isInline"] is True

    @responses.activate
    def test_no_attachments(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"value": []},
            status=200,
        )
        result = mod.list_attachments("token", "msg1")
        assert result["count"] == 0


class TestDownloadAttachment:
    @responses.activate
    def test_download(self):
        file_content = b"Hello, World!"
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/v1\.0/me/messages/msg1/attachments/att1"),
            json={
                "name": "test.txt",
                "contentBytes": base64.b64encode(file_content).decode(),
                "size": len(file_content),
            },
            status=200,
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            result = mod.download_attachment("token", "msg1", "att1", output_dir=tmpdir)
            assert result["success"] is True
            assert result["fileName"] == "test.txt"
            assert os.path.exists(result["filePath"])
            with open(result["filePath"], "rb") as f:
                assert f.read() == file_content

    @responses.activate
    def test_download_no_content(self):
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={"name": "empty.txt", "contentBytes": "", "size": 0},
            status=200,
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            result = mod.download_attachment("token", "msg1", "att1", output_dir=tmpdir)
            assert result["error"] == "NO_CONTENT"

    @responses.activate
    def test_download_filename_collision(self):
        file_content = b"data"
        responses.get(
            url=re.compile(r"https://graph\.microsoft\.com/.*"),
            json={
                "name": "test.txt",
                "contentBytes": base64.b64encode(file_content).decode(),
                "size": len(file_content),
            },
            status=200,
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create existing file to trigger collision
            with open(os.path.join(tmpdir, "test.txt"), "w") as f:
                f.write("existing")
            result = mod.download_attachment("token", "msg1", "att1", output_dir=tmpdir)
            assert result["success"] is True
            assert result["fileName"] == "test_1.txt"
