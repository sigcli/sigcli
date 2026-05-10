#!/usr/bin/env python3
"""Use CDP Network domain to passively observe page's API requests."""
import sys
import json
import os
import time
import websocket
import subprocess
import urllib.request

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

# Enable Network BEFORE navigation
cmd("Network.enable")
cmd("Page.navigate", {"url": "https://www.xiaohongshu.com/explore"})
print("Navigating, capturing network events...")

# Collect Network.requestWillBeSent events for edith requests
captured = []
deadline = time.time() + 15

ws.settimeout(1)
while time.time() < deadline:
    try:
        raw = ws.recv()
        msg = json.loads(raw)
        if msg.get("method") == "Network.requestWillBeSent":
            req = msg["params"].get("request", {})
            url = req.get("url", "")
            if "edith.xiaohongshu.com" in url and req.get("method") != "OPTIONS":
                headers = req.get("headers", {})
                captured.append({
                    "method": req.get("method"),
                    "url": url[:100],
                    "has_xs": "x-s" in headers or "X-s" in headers,
                    "has_xsc": "x-s-common" in headers or "X-s-common" in headers,
                    "has_xt": "x-t" in headers or "X-t" in headers,
                    "has_rap": "x-rap-param" in headers,
                    "headers": {k: v[:60] for k, v in headers.items() if k.lower().startswith("x-")}
                })
    except websocket.WebSocketTimeoutException:
        continue

print(f"\nCaptured {len(captured)} API requests:")
for i, c in enumerate(captured[:10]):
    print(f"\n[{i}] {c['method']} {c['url']}")
    print(f"     x-s={c['has_xs']} x-s-common={c['has_xsc']} x-t={c['has_xt']} x-rap-param={c['has_rap']}")
    if c["headers"]:
        for k, v in c["headers"].items():
            print(f"     {k}: {v}...")

ws.close()
proc.terminate()
