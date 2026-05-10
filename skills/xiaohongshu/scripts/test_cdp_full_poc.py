#!/usr/bin/env python3
"""POC v2: test ALL 5 APIs using browser-generated signing headers."""
import sys
import json
import os
import time
import math
import random
import websocket
import subprocess
import urllib.request
import requests as http_requests

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

# Navigate and capture X-S-Common
cmd("Network.enable")
cmd("Page.navigate", {"url": "https://www.xiaohongshu.com/explore"})

xs_common = None
deadline = time.time() + 15
ws.settimeout(1)
while time.time() < deadline:
    try:
        msg = json.loads(ws.recv())
        if msg.get("method") == "Network.requestWillBeSent":
            req = msg["params"].get("request", {})
            headers = req.get("headers", {})
            if "edith.xiaohongshu.com" in req.get("url", "") and "X-S-Common" in headers:
                xs_common = headers["X-S-Common"]
                break
    except websocket.WebSocketTimeoutException:
        continue

ws.settimeout(60)
if not xs_common:
    print("ERROR: no X-S-Common captured"); proc.terminate(); sys.exit(1)
print(f"Captured X-S-Common ({len(xs_common)} chars)")

time.sleep(5)  # Wait for page JS to fully load

def sign_and_call(method, path, body=None):
    """Generate signing headers via CDP and make HTTP request."""
    # Call _webmsxyw in page context
    body_str = json.dumps(body, separators=(",", ":"), ensure_ascii=False) if body else ""
    js = f'JSON.stringify(window._webmsxyw("{path}", {json.dumps(body_str)}))'
    r = cmd("Runtime.evaluate", {"expression": js, "returnByValue": True})
    sign = json.loads(r.get("result", {}).get("value", "{}"))
    xs = sign.get("X-s", "")
    xt = str(sign.get("X-t", ""))

    traceid = "".join("abcdef0123456789"[math.floor(16 * random.random())] for _ in range(16))

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
        "Content-Type": "application/json;charset=UTF-8",
    }

    url = f"https://edith.xiaohongshu.com{path}"
    if method == "GET":
        resp = http_requests.get(url, headers=headers, timeout=15)
    else:
        resp = http_requests.post(url, headers=headers, data=body_str.encode("utf-8") if body_str else None, timeout=15)

    return resp.status_code, resp.json()


# ============ TEST ALL 5 APIs ============

print("\n=== 1. POST /search/notes ===")
time.sleep(2)
status, data = sign_and_call("POST", "/api/sns/web/v1/search/notes", {
    "keyword": "Python", "page": 1, "page_size": 20, "search_id": "cdpfinal99",
    "sort": "general", "note_type": 0, "ext_flags": [],
    "filters": [], "geo": "", "image_formats": ["jpg", "webp", "avif"],
})
items = data.get("data", {}).get("items", [])
print(f"   status={status} code={data.get('code')} items={len(items)}")
note_id = items[0]["id"] if items else ""
xsec = items[0].get("xsec_token", "") if items else ""
author = items[0].get("note_card", {}).get("user", {}).get("user_id", "") if items else ""

print("\n=== 2. POST /feed (note detail) ===")
time.sleep(2)
if note_id:
    status, data = sign_and_call("POST", "/api/sns/web/v1/feed", {
        "source_note_id": note_id, "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"}, "xsec_source": "pc_search", "xsec_token": xsec,
    })
    note_items = data.get("data", {}).get("items", [])
    title = note_items[0].get("note_card", {}).get("title", "?") if note_items else "?"
    print(f"   status={status} code={data.get('code')} title={title[:40]}")
else:
    print("   SKIP")

print("\n=== 3. GET /comment/page ===")
time.sleep(2)
if note_id:
    path = f"/api/sns/web/v2/comment/page?note_id={note_id}&cursor=&top_comment_id=&image_formats=jpg,webp,avif&xsec_token={xsec}"
    status, data = sign_and_call("GET", path)
    comments = data.get("data", {}).get("comments", [])
    print(f"   status={status} code={data.get('code')} comments={len(comments)}")
else:
    print("   SKIP")

print("\n=== 4. GET /user/otherinfo ===")
time.sleep(2)
if author:
    path = f"/api/sns/web/v1/user/otherinfo?target_user_id={author}"
    status, data = sign_and_call("GET", path)
    nick = data.get("data", {}).get("basic_info", {}).get("nickname", "?")
    print(f"   status={status} code={data.get('code')} nickname={nick}")
else:
    print("   SKIP")

print("\n=== 5. GET /user_posted ===")
time.sleep(2)
if author:
    path = f"/api/sns/web/v1/user_posted?num=5&cursor=&user_id={author}&image_scenes=FD_WM_WEBP"
    status, data = sign_and_call("GET", path)
    notes = data.get("data", {}).get("notes", [])
    print(f"   status={status} code={data.get('code')} notes={len(notes)}")
else:
    print("   SKIP")

ws.close()
proc.terminate()
print("\n=== DONE ===")
