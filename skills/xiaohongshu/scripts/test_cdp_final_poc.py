#!/usr/bin/env python3
"""
POC: Use CDP to call _webmsxyw for X-s/X-t, capture X-S-Common from a live request,
then use these headers to make a direct HTTP call to user_posted (previously 406).
"""
import sys
import json
import os
import time
import websocket
import subprocess
import urllib.request
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import _find_free_port, _get_browser_path, _wait_for_cdp

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

# Launch browser
port = _find_free_port()
browser_path = _get_browser_path()
data_dir = os.path.expanduser("~/.sig/browser-data")
args = [browser_path, f"--remote-debugging-port={port}", f"--user-data-dir={data_dir}",
        "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "about:blank"]
proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(2)
ws_url = _wait_for_cdp(port)

targets = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/json").read())
page = next(t for t in targets if t["type"] == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=60)
msg_id = 0

def cmd(method, params=None):
    global msg_id
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    while True:
        r = json.loads(ws.recv())
        if r.get("id") == msg_id:
            return r.get("result", {})

# Navigate and capture X-S-Common from a real request
cmd("Network.enable")
cmd("Page.navigate", {"url": "https://www.xiaohongshu.com/explore"})
print("Navigating... capturing headers from page's own requests...")

# Collect first API request's headers
xs_common = None
deadline = time.time() + 15
ws.settimeout(1)
while time.time() < deadline:
    try:
        raw = ws.recv()
        msg = json.loads(raw)
        if msg.get("method") == "Network.requestWillBeSent":
            req = msg["params"].get("request", {})
            url = req.get("url", "")
            headers = req.get("headers", {})
            if "edith.xiaohongshu.com" in url and "X-S-Common" in headers:
                xs_common = headers["X-S-Common"]
                print(f"  Captured X-S-Common from: {url[:60]}")
                print(f"  Length: {len(xs_common)}")
                break
    except websocket.WebSocketTimeoutException:
        continue

if not xs_common:
    print("ERROR: could not capture X-S-Common")
    ws.close()
    proc.terminate()
    sys.exit(1)

# Wait for page to fully load (so _webmsxyw is available)
ws.settimeout(60)
time.sleep(5)

# Now call _webmsxyw for the target endpoint
target_path = "/api/sns/web/v1/user_posted?num=5&cursor=&user_id=5f84695f0000000001008c8d&image_scenes=FD_WM_WEBP"
js = f'JSON.stringify(window._webmsxyw("{target_path}", ""))'
r = cmd("Runtime.evaluate", {"expression": js, "returnByValue": True})
sign_result = json.loads(r.get("result", {}).get("value", "{}"))
xs = sign_result.get("X-s", "")
xt = str(sign_result.get("X-t", ""))
print(f"\n_webmsxyw result: X-s={xs[:30]}... X-t={xt}")

# Also generate traceid
import random, math
traceid = "".join("abcdef0123456789"[math.floor(16 * random.random())] for _ in range(16))

# Now make a direct HTTP request with these headers
print(f"\nMaking HTTP GET to {target_path[:60]}...")
url = f"https://edith.xiaohongshu.com{target_path}"
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0",
    "Cookie": cookie,
    "Origin": "https://www.xiaohongshu.com",
    "Referer": "https://www.xiaohongshu.com/",
    "X-s": xs,
    "X-t": xt,
    "X-S-Common": xs_common,
    "x-b3-traceid": traceid,
    "Accept": "application/json, text/plain, */*",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
}

resp = requests.get(url, headers=headers, timeout=15)
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Code: {data.get('code')}, success: {data.get('success')}")
notes = data.get("data", {}).get("notes", [])
print(f"Notes: {len(notes)}")
if notes:
    print(f"  First: {notes[0].get('display_title', '?')}")

ws.close()
proc.terminate()
print("\nDone.")
