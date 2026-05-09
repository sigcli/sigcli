#!/usr/bin/env python3
"""Xiaohongshu API client using headless browser + CDP Fetch intercept.

Architecture:
- Starts headless browser sharing sigcli's browser-data (has login state)
- Navigates to XHS pages to trigger API calls with proper signing
- Intercepts API responses via CDP Fetch domain
- For SSR pages (note detail, user profile), extracts from __INITIAL_STATE__

This approach is immune to signing algorithm changes since XHS's own
frontend handles all anti-bot headers (x-s, x-t, x-s-common, x-rap-param).
"""

import asyncio
import base64
import json
import os
import socket
import subprocess
import time
from typing import Any, Dict, Optional
from urllib.parse import quote

try:
    import websockets
except ImportError:
    websockets = None

BROWSER_DATA_DIR = os.path.expanduser("~/.sig/browser-data")
XHS_BASE = "https://www.xiaohongshu.com"


class XhsApiError(Exception):
    def __init__(self, code: int, msg: str):
        self.code = code
        self.msg = msg
        super().__init__(f"XHS API error {code}: {msg}")


class XhsClient:
    """Xiaohongshu client using headless browser navigation + response interception."""

    def __init__(self):
        self._ws_url = ""
        self._browser_proc = None
        self._port = None

    def connect(self):
        """Start headless browser and connect via CDP."""
        if not websockets:
            raise XhsApiError(-1, "Missing dependency: pip install websockets")
        self._start_browser()
        self._ws_url = self._get_ws_url()
        # Remove service worker (interferes with Fetch intercept)
        asyncio.run(self._remove_service_worker())

    def close(self):
        """Stop browser."""
        if self._browser_proc:
            self._browser_proc.terminate()
            try:
                self._browser_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._browser_proc.kill()
            self._browser_proc = None

    # =========================================================================
    # Public API
    # =========================================================================

    def search_notes(self, keyword: str, sort: str = "general") -> Dict[str, Any]:
        """Search notes by keyword."""
        url = f"{XHS_BASE}/search_result?keyword={quote(keyword)}&source=web_search_result_note"
        if sort != "general":
            url += f"&sort={sort}"

        data = asyncio.run(self._navigate_and_intercept(url, "*search/notes*"))
        if not data:
            raise XhsApiError(-1, "Failed to intercept search response")
        if data.get("code") != 0:
            raise XhsApiError(data.get("code", -1), data.get("msg", ""))

        items = data.get("data", {}).get("items", [])
        notes = []
        for item in items:
            card = item.get("note_card", {})
            user = card.get("user", {})
            interact = card.get("interact_info", {})
            notes.append({
                "id": card.get("note_id", item.get("id", "")),
                "title": card.get("display_title", ""),
                "type": card.get("type", ""),
                "author": user.get("nickname", ""),
                "author_id": user.get("user_id", ""),
                "likes": interact.get("liked_count", "0"),
                "cover": card.get("cover", {}).get("url", ""),
            })
        return {"count": len(notes), "notes": notes}

    def get_note(self, note_id: str) -> Dict[str, Any]:
        """Get note detail (SSR - extract from page state)."""
        url = f"{XHS_BASE}/explore/{note_id}"
        state = asyncio.run(self._navigate_and_extract_state(url, self._extract_note_js(note_id)))
        if not state:
            raise XhsApiError(-1, f"Failed to load note {note_id}")
        return state

    def get_user(self, user_id: str) -> Dict[str, Any]:
        """Get user profile (SSR - extract from page state)."""
        url = f"{XHS_BASE}/user/profile/{user_id}"
        state = asyncio.run(self._navigate_and_extract_state(url, self._extract_user_js()))
        if not state:
            raise XhsApiError(-1, f"Failed to load user {user_id}")
        return state

    def get_comments(self, note_id: str) -> Dict[str, Any]:
        """Get note comments (extracted from page state after navigation)."""
        url = f"{XHS_BASE}/explore/{note_id}"
        state = asyncio.run(self._navigate_and_extract_state(url, self._extract_comments_js(note_id)))
        if not state:
            raise XhsApiError(-1, f"Failed to load comments for {note_id}")
        return state

    # =========================================================================
    # Browser management
    # =========================================================================

    def _find_browser(self) -> str:
        paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
        for p in paths:
            if os.path.exists(p):
                return p
        raise XhsApiError(-1, "No Chrome/Edge/Chromium found")

    def _start_browser(self):
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        self._port = s.getsockname()[1]
        s.close()

        exec_path = self._find_browser()
        args = [
            exec_path,
            f"--user-data-dir={BROWSER_DATA_DIR}",
            f"--remote-debugging-port={self._port}",
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            f"{XHS_BASE}/explore",
        ]
        self._browser_proc = subprocess.Popen(
            args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        time.sleep(6)

    def _get_ws_url(self) -> str:
        import requests
        for _ in range(15):
            try:
                pages = requests.get(f"http://127.0.0.1:{self._port}/json", timeout=2).json()
                for p in pages:
                    if "xiaohongshu" in p.get("url", ""):
                        return p["webSocketDebuggerUrl"]
            except Exception:
                time.sleep(0.5)
        raise XhsApiError(-1, "Cannot connect to browser CDP")

    async def _remove_service_worker(self):
        async with websockets.connect(self._ws_url, max_size=50 * 1024 * 1024) as ws:
            js = "navigator.serviceWorker.getRegistrations().then(rs => {rs.forEach(r => r.unregister()); return rs.length})"
            msg = {"id": 1, "method": "Runtime.evaluate", "params": {"expression": js, "awaitPromise": True, "returnByValue": True}}
            await ws.send(json.dumps(msg))
            await ws.recv()
            # Reload page so SW removal takes effect
            await ws.send(json.dumps({"id": 2, "method": "Page.reload", "params": {}}))
            await ws.recv()
            await asyncio.sleep(3)

    # =========================================================================
    # CDP operations
    # =========================================================================

    async def _navigate_and_intercept(self, url: str, pattern: str, timeout: float = 12) -> Optional[Dict]:
        """Navigate to URL and intercept matching API response."""
        async with websockets.connect(self._ws_url, max_size=50 * 1024 * 1024) as ws:
            await ws.send(json.dumps({"id": 1, "method": "Fetch.enable", "params": {"patterns": [{"urlPattern": pattern, "requestStage": "Response"}]}}))
            await ws.recv()

            await ws.send(json.dumps({"id": 2, "method": "Page.navigate", "params": {"url": url}}))
            await ws.recv()

            result = None
            start = asyncio.get_event_loop().time()
            while asyncio.get_event_loop().time() - start < timeout:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=1)
                    data = json.loads(msg)
                    if data.get("method") == "Fetch.requestPaused":
                        req_id = data["params"]["requestId"]
                        await ws.send(json.dumps({"id": 3, "method": "Fetch.getResponseBody", "params": {"requestId": req_id}}))
                        body_msg = json.loads(await ws.recv())
                        body = body_msg.get("result", {}).get("body", "")
                        if body_msg.get("result", {}).get("base64Encoded") and body:
                            body = base64.b64decode(body).decode("utf-8")
                        if body:
                            result = json.loads(body)
                        await ws.send(json.dumps({"id": 4, "method": "Fetch.continueResponse", "params": {"requestId": req_id}}))
                        await ws.recv()
                        break
                except asyncio.TimeoutError:
                    continue

            await ws.send(json.dumps({"id": 5, "method": "Fetch.disable", "params": {}}))
            await ws.recv()
            return result

    async def _navigate_and_extract_state(self, url: str, js_expression: str, timeout: float = 8) -> Optional[Dict]:
        """Navigate to URL and extract data from __INITIAL_STATE__."""
        async with websockets.connect(self._ws_url, max_size=50 * 1024 * 1024) as ws:
            await ws.send(json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": url}}))
            await ws.recv()

            for _ in range(int(timeout * 2)):
                await asyncio.sleep(0.5)
                msg = {"id": 2, "method": "Runtime.evaluate", "params": {"expression": js_expression, "returnByValue": True}}
                await ws.send(json.dumps(msg))
                resp = json.loads(await ws.recv())
                val = resp.get("result", {}).get("result", {}).get("value", "")
                if val:
                    return json.loads(val)
            return None

    # =========================================================================
    # State extraction JS
    # =========================================================================

    @staticmethod
    def _extract_note_js(note_id: str) -> str:
        return (
            "(function() {"
            "  var state = window.__INITIAL_STATE__;"
            "  if (!state || !state.note) return '';"
            "  var map = state.note.noteDetailMap;"
            "  var id = state.note.currentNoteId || '" + note_id + "';"
            "  if (!map || !map[id]) return '';"
            "  var n = map[id].note;"
            "  if (!n) return '';"
            "  return JSON.stringify({"
            "    id: n.noteId || id,"
            "    title: n.title || '',"
            "    desc: n.desc || '',"
            "    type: n.type || '',"
            "    likes: n.interactInfo?.likedCount || '0',"
            "    collects: n.interactInfo?.collectedCount || '0',"
            "    comments_count: n.interactInfo?.commentCount || '0',"
            "    shares: n.interactInfo?.shareCount || '0',"
            "    author: n.user?.nickname || '',"
            "    author_id: n.user?.userId || '',"
            "    tags: (n.tagList || []).map(function(t){return t.name}).slice(0, 10),"
            "    images: (n.imageList || []).map(function(i){return i.urlDefault || i.url || ''}).slice(0, 9),"
            "    time: n.time || '',"
            "  });"
            "})()"
        )

    @staticmethod
    def _extract_user_js() -> str:
        return (
            "(function() {"
            "  var state = window.__INITIAL_STATE__;"
            "  if (!state || !state.user) return '';"
            "  var u = state.user.userPageData;"
            "  if (!u) return '';"
            "  var info = u.basicInfo || {};"
            "  var inter = u.interactions || [];"
            "  return JSON.stringify({"
            "    id: info.userId || '',"
            "    nickname: info.nickname || '',"
            "    desc: info.desc || '',"
            "    gender: info.gender || '',"
            "    ip_location: info.ipLocation || '',"
            "    red_id: info.redId || '',"
            "    follows: inter[0]?.count || '0',"
            "    fans: inter[1]?.count || '0',"
            "    notes_count: inter[2]?.count || '0',"
            "    liked_count: inter[3]?.count || '0',"
            "  });"
            "})()"
        )

    @staticmethod
    def _extract_comments_js(note_id: str) -> str:
        return (
            "(function() {"
            "  var state = window.__INITIAL_STATE__;"
            "  if (!state || !state.note) return '';"
            "  var map = state.note.noteDetailMap;"
            "  var id = state.note.currentNoteId || '" + note_id + "';"
            "  if (!map || !map[id]) return '';"
            "  var comments = map[id].comments || [];"
            "  if (!comments.length) return '';"
            "  return JSON.stringify({"
            "    note_id: id,"
            "    count: comments.length,"
            "    comments: comments.slice(0, 20).map(function(c) {"
            "      return {"
            "        id: c.id || '',"
            "        user: c.userInfo?.nickname || '',"
            "        content: c.content || '',"
            "        likes: c.likeCount || 0,"
            "        time: c.createTime || '',"
            "      };"
            "    }),"
            "  });"
            "})()"
        )
