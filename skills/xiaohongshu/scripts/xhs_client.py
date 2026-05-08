#!/usr/bin/env python3
"""Xiaohongshu API client with CDP-based request signing.

Uses a headless browser (shared browser-data with sigcli) to call
XHS's internal signing function window._webmsxyw(uri, data).
"""

import asyncio
import json
import os
import random
import string
import subprocess
import time
from typing import Any, Dict, Optional

import requests

try:
    import websockets
except ImportError:
    websockets = None

API_BASE = "https://edith.xiaohongshu.com"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
)
BROWSER_DATA_DIR = os.path.expanduser("~/.sig/browser-data-xhs-sign")
XHS_URL = "https://www.xiaohongshu.com/"


class XhsApiError(Exception):
    def __init__(self, code: int, msg: str):
        self.code = code
        self.msg = msg
        super().__init__(f"XHS API error {code}: {msg}")


class XhsClient:
    """Xiaohongshu API client using CDP for signing."""

    def __init__(self):
        self._cookie = ""
        self._ws_url = ""
        self._browser_pid = None
        self._port = None

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
        """Start headless browser sharing sigcli's browser-data."""
        import socket
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
            XHS_URL,
        ]
        self._browser_pid = subprocess.Popen(
            args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        ).pid
        # Wait for CDP ready
        time.sleep(5)

    def _get_ws_url(self) -> str:
        for _ in range(10):
            try:
                resp = requests.get(f"http://127.0.0.1:{self._port}/json", timeout=2)
                pages = resp.json()
                for p in pages:
                    if "xiaohongshu" in p.get("url", ""):
                        return p["webSocketDebuggerUrl"]
            except Exception:
                time.sleep(0.5)
        raise XhsApiError(-1, "Cannot connect to browser CDP")

    def _stop_browser(self):
        if self._browser_pid:
            try:
                os.kill(self._browser_pid, 9)
            except ProcessLookupError:
                pass
            self._browser_pid = None

    async def _cdp_sign(self, ws_url: str, uri: str, data: Optional[str] = None) -> Dict[str, str]:
        """Call window._webmsxyw via CDP to get signing headers."""
        async with websockets.connect(ws_url, max_size=10 * 1024 * 1024) as ws:
            # Wait for signing function to be available
            for _ in range(10):
                check = {"id": 99, "method": "Runtime.evaluate", "params": {"expression": "typeof window._webmsxyw", "returnByValue": True}}
                await ws.send(json.dumps(check))
                resp = json.loads(await ws.recv())
                if resp.get("result", {}).get("result", {}).get("value") == "function":
                    break
                await asyncio.sleep(1)
            else:
                raise XhsApiError(-1, "Signing function not available after waiting")

            js_uri = uri.replace("'", "\\'")
            if data:
                js_data = data.replace("\\", "\\\\").replace("'", "\\'")
                expr = f"JSON.stringify(window._webmsxyw('{js_uri}', '{js_data}'))"
            else:
                expr = f"JSON.stringify(window._webmsxyw('{js_uri}', undefined))"

            msg = {"id": 1, "method": "Runtime.evaluate", "params": {"expression": expr, "returnByValue": True, "awaitPromise": True}}
            await ws.send(json.dumps(msg))
            resp = json.loads(await ws.recv())

            result = resp.get("result", {}).get("result", {})
            if result.get("subtype") == "error" or not result.get("value"):
                raise XhsApiError(-1, f"Signing failed: {result.get('description', 'unknown')}")

            signs = json.loads(result["value"])
            return {
                "x-s": signs.get("X-s", ""),
                "x-t": str(signs.get("X-t", "")),
                "x-s-common": signs.get("X-s-common", ""),
            }

    async def _inject_cookies(self, ws_url: str, cookie_str: str):
        """Inject cookies into the browser page so signing function has context."""
        async with websockets.connect(ws_url, max_size=10 * 1024 * 1024) as ws:
            for part in cookie_str.split("; "):
                if "=" not in part:
                    continue
                name, value = part.split("=", 1)
                msg = {
                    "id": 1,
                    "method": "Network.setCookie",
                    "params": {
                        "name": name.strip(),
                        "value": value.strip(),
                        "domain": ".xiaohongshu.com",
                        "path": "/",
                    },
                }
                await ws.send(json.dumps(msg))
                await ws.recv()
            # Reload page so JS picks up the cookies
            msg = {"id": 2, "method": "Page.reload", "params": {}}
            await ws.send(json.dumps(msg))
            await ws.recv()
            await asyncio.sleep(3)

    async def _cdp_cookies(self, ws_url: str) -> str:
        """Get cookies from browser via CDP."""
        async with websockets.connect(ws_url, max_size=10 * 1024 * 1024) as ws:
            msg = {"id": 1, "method": "Network.getCookies", "params": {"urls": ["https://www.xiaohongshu.com", "https://edith.xiaohongshu.com"]}}
            await ws.send(json.dumps(msg))
            resp = json.loads(await ws.recv())
            cookies = resp.get("result", {}).get("cookies", [])
            return "; ".join(f"{c['name']}={c['value']}" for c in cookies)

    def _sign(self, uri: str, data: Optional[str] = None) -> Dict[str, str]:
        """Synchronous wrapper for CDP signing."""
        return asyncio.run(self._cdp_sign(self._ws_url, uri, data))

    def _cookies(self) -> str:
        """Synchronous wrapper for getting cookies."""
        return asyncio.run(self._cdp_cookies(self._ws_url))

    def connect(self, cookie: str = ""):
        """Start browser and connect. Pass cookie from sig run env."""
        if not websockets:
            raise XhsApiError(-1, "websockets package required: pip install websockets")
        if not cookie:
            cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
        if not cookie:
            raise XhsApiError(-1, "AUTH_REQUIRED: no cookie provided")
        self._cookie = cookie
        self._start_browser()
        self._ws_url = self._get_ws_url()
        # Inject cookies into the headless browser so _webmsxyw works
        asyncio.run(self._inject_cookies(self._ws_url, cookie))

    def close(self):
        self._stop_browser()

    def get(self, uri: str) -> Dict[str, Any]:
        """Signed GET request."""
        signs = self._sign(uri, None)
        headers = {
            "User-Agent": USER_AGENT,
            "Origin": "https://www.xiaohongshu.com",
            "Referer": "https://www.xiaohongshu.com/",
            "Accept": "application/json, text/plain, */*",
            "Cookie": self._cookie,
            **signs,
        }
        resp = requests.get(f"{API_BASE}{uri}", headers=headers, timeout=15)
        return self._handle_response(resp)

    def post(self, uri: str, data: Dict) -> Dict[str, Any]:
        """Signed POST request."""
        body = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
        signs = self._sign(uri, body)
        headers = {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json;charset=UTF-8",
            "Origin": "https://www.xiaohongshu.com",
            "Referer": "https://www.xiaohongshu.com/",
            "Cookie": self._cookie,
            **signs,
        }
        resp = requests.post(f"{API_BASE}{uri}", headers=headers, data=body, timeout=15)
        return self._handle_response(resp)

    def _handle_response(self, resp: requests.Response) -> Dict[str, Any]:
        if resp.status_code == 461:
            raise XhsApiError(461, "Signature rejected")
        if resp.status_code == 406:
            raise XhsApiError(406, "Request blocked (missing or invalid signature)")
        resp.raise_for_status()
        result = resp.json()
        if not result.get("success") and result.get("code", 0) != 0:
            raise XhsApiError(result.get("code", -1), result.get("msg", "Unknown error"))
        return result
