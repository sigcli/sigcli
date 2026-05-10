#!/usr/bin/env python3
"""XHS Browser Manager — headless browser with CDP for Xiaohongshu API calls.

Architecture:
  1. `init()` — launch headless browser, inject cookies, navigate to XHS, wait for JS ready
  2. `call_api(method, path, params_or_payload)` — execute fetch() in page context via CDP
  3. Browser handles all signing (x-s, x-s-common, x-t, x-rap-param) automatically

State file: ~/.sig/xhs-browser.json (CDP port + PID for reuse)
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
import socket
import websocket

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

XHS_HOME = "https://www.xiaohongshu.com/explore"
XHS_API_BASE = "https://edith.xiaohongshu.com"
STATE_FILE = os.path.expanduser("~/.sig/xhs-browser.json")
BROWSER_READY_TIMEOUT = 30  # seconds
CDP_TIMEOUT = 15  # seconds per API call


# ---------------------------------------------------------------------------
# CDP WebSocket Client (minimal, no external deps)
# ---------------------------------------------------------------------------


class CdpClient:
    """Minimal CDP client over WebSocket."""

    def __init__(self, ws_url: str, timeout: float = 30):
        self._ws = websocket.create_connection(ws_url, timeout=timeout)
        self._id = 0

    def send(self, method: str, params: dict | None = None) -> dict:
        self._id += 1
        msg = {"id": self._id, "method": method, "params": params or {}}
        self._ws.send(json.dumps(msg))
        while True:
            resp = json.loads(self._ws.recv())
            # Skip event notifications (no "id" field)
            if "id" not in resp:
                continue
            if resp.get("id") == self._id:
                if "error" in resp:
                    raise RuntimeError(f"CDP error: {resp['error']}")
                return resp.get("result", {})

    def close(self):
        self._ws.close()


# ---------------------------------------------------------------------------
# Browser lifecycle
# ---------------------------------------------------------------------------


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _get_browser_path() -> str:
    """Detect browser path — prefer Edge (matches sig's config)."""
    candidates = [
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    raise RuntimeError("No Chrome/Edge/Chromium found")


def _wait_for_cdp(port: int, timeout: float = 10) -> str:
    """Wait for CDP to be ready and return the WebSocket URL."""
    import urllib.request
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version")
            data = json.loads(resp.read())
            return data["webSocketDebuggerUrl"]
        except Exception:
            time.sleep(0.3)
    raise RuntimeError(f"CDP not ready on port {port} after {timeout}s")


def _parse_cookies(cookie_str: str) -> list[dict]:
    """Parse cookie string into CDP Network.setCookie format."""
    cookies = []
    for part in cookie_str.split(";"):
        part = part.strip()
        if "=" in part:
            name, _, value = part.partition("=")
            cookies.append({
                "name": name.strip(),
                "value": value.strip(),
                "domain": ".xiaohongshu.com",
                "path": "/",
            })
    return cookies


def launch_browser(cookie_str: str) -> dict:
    """Launch headless browser, inject cookies, navigate to XHS.

    Returns state dict: {pid, port, ws_url}
    """
    port = _find_free_port()
    browser_path = _get_browser_path()
    # Use sig's browser data dir — same profile as sig login, already trusted by XHS
    data_dir = os.path.expanduser("~/.sig/browser-data")

    args = [
        browser_path,
        f"--remote-debugging-port={port}",
        f"--user-data-dir={data_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-allow-origins=*",
        "about:blank",
    ]

    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # Check if process started
    time.sleep(1)
    if proc.poll() is not None:
        stderr = proc.stderr.read().decode()
        raise RuntimeError(f"Browser failed to start: {stderr[:300]}")

    ws_url = _wait_for_cdp(port)

    # Connect and setup
    cdp = CdpClient(ws_url)

    # Get the page target
    import urllib.request
    targets = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/json").read())
    page_target = next((t for t in targets if t.get("type") == "page"), None)
    if not page_target:
        raise RuntimeError("No page target found")

    page_ws = page_target["webSocketDebuggerUrl"]
    cdp.close()

    # Connect to page and navigate
    cdp = CdpClient(page_ws)
    cdp.send("Page.enable", {})
    cdp.send("Page.navigate", {"url": XHS_HOME})
    # Wait for page to fully load and JS to initialize
    time.sleep(8)
    cdp.close()

    # Re-fetch page WS URL after navigation (target may have changed)
    targets = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/json").read())
    page_target = next((t for t in targets if t.get("type") == "page" and "xiaohongshu" in t.get("url", "")), None)
    if not page_target:
        page_target = next((t for t in targets if t.get("type") == "page"), None)
    if not page_target:
        raise RuntimeError("No page target after navigate")
    page_ws = page_target["webSocketDebuggerUrl"]

    state = {"pid": proc.pid, "port": port, "ws_url": page_ws}
    # Save state for reuse
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)

    return state


def connect_existing() -> dict | None:
    """Try to connect to an existing browser instance."""
    if not os.path.exists(STATE_FILE):
        return None
    try:
        with open(STATE_FILE) as f:
            state = json.load(f)
        # Verify it's alive
        pid = state["pid"]
        os.kill(pid, 0)  # Check if process exists
        # Try connecting
        ws = websocket.create_connection(state["ws_url"], timeout=3)
        ws.close()
        return state
    except Exception:
        # Clean up stale state
        try:
            os.unlink(STATE_FILE)
        except OSError:
            pass
        return None


def ensure_browser(cookie_str: str) -> dict:
    """Get or create browser instance."""
    state = connect_existing()
    if state:
        return state
    return launch_browser(cookie_str)


def stop_browser():
    """Stop the managed browser instance."""
    if not os.path.exists(STATE_FILE):
        return
    try:
        with open(STATE_FILE) as f:
            state = json.load(f)
        os.kill(state["pid"], signal.SIGTERM)
    except Exception:
        pass
    finally:
        try:
            os.unlink(STATE_FILE)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# API call via CDP
# ---------------------------------------------------------------------------


def call_api(state: dict, method: str, path: str, params_or_payload: dict | None = None) -> dict:
    """Execute an API call through the browser via CDP Runtime.evaluate.

    Uses XMLHttpRequest (not fetch) so the page's axios interceptors
    automatically add signing headers (x-s, x-s-common, x-t, x-rap-param).
    """
    cdp = CdpClient(state["ws_url"], timeout=30)

    if method.upper() == "GET":
        if params_or_payload:
            from urllib.parse import urlencode
            query = urlencode(params_or_payload, doseq=True)
            url = f"{XHS_API_BASE}{path}?{query}"
        else:
            url = f"{XHS_API_BASE}{path}"
        js_payload = "null"
    else:  # POST
        url = f"{XHS_API_BASE}{path}"
        body = json.dumps(params_or_payload or {}, separators=(",", ":"), ensure_ascii=False)
        js_payload = json.dumps(body)  # double-encode: Python string → JS string literal

    # Use XHR which triggers page's axios interceptors for auto-signing
    js = (
        "(function() {"
        "  return new Promise(function(resolve, reject) {"
        "    var xhr = new XMLHttpRequest();"
        f"    xhr.open({json.dumps(method.upper())}, {json.dumps(url)});"
        "    xhr.withCredentials = true;"
        '    xhr.setRequestHeader("content-type", "application/json;charset=UTF-8");'
        "    xhr.onload = function() { resolve(xhr.responseText); };"
        "    xhr.onerror = function() { reject('XHR error: ' + xhr.status); };"
        f"    xhr.send({js_payload});"
        "  });"
        "})()"
    )

    result = cdp.send("Runtime.evaluate", {
        "expression": js,
        "awaitPromise": True,
        "returnByValue": True,
    })
    cdp.close()

    # Parse response
    value = result.get("result", {}).get("value", "")
    if not value:
        error = result.get("exceptionDetails", {})
        raise RuntimeError(f"CDP eval failed: {error}")

    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        raise RuntimeError(f"Non-JSON response: {value[:200]}")

    return data


# ---------------------------------------------------------------------------
# CLI interface
# ---------------------------------------------------------------------------


def main():
    """CLI for browser management: init, stop, call."""
    if len(sys.argv) < 2:
        print("Usage: xhs_browser.py <init|stop|call> [args...]", file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "init":
        cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
        if not cookie:
            print(json.dumps({"error": "AUTH_REQUIRED", "message": "Run: sig login xiaohongshu"}))
            sys.exit(1)
        state = ensure_browser(cookie)
        print(json.dumps({"status": "ready", "pid": state["pid"], "port": state["port"]}))

    elif cmd == "stop":
        stop_browser()
        print(json.dumps({"status": "stopped"}))

    elif cmd == "call":
        if len(sys.argv) < 4:
            print("Usage: xhs_browser.py call <GET|POST> <path> [json_payload]", file=sys.stderr)
            sys.exit(1)
        method = sys.argv[2]
        path = sys.argv[3]
        payload = json.loads(sys.argv[4]) if len(sys.argv) > 4 else None

        cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
        state = ensure_browser(cookie)
        data = call_api(state, method, path, payload)
        print(json.dumps(data, indent=2, ensure_ascii=False))

    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
