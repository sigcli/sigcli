#!/usr/bin/env python3
"""Test: send XHR without content-type to avoid CORS preflight."""
import sys
import json
import os
import time
import base64

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser, CdpClient

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)
cdp = CdpClient(state["ws_url"], timeout=30)

# Enable network
cdp.send("Network.enable", {})

# XHR WITHOUT setting content-type header (avoid CORS preflight)
body = json.dumps({"num": 3, "refresh_type": 1, "note_index": 0, "cursor_score": "",
    "unread_begin_note_id": "", "unread_end_note_id": "",
    "unread_note_count": 0, "category": "homefeed_recommend"}, separators=(",", ":"))
b64 = base64.b64encode(body.encode()).decode()

# Don't set content-type - let browser use default (avoids preflight)
# Actually the issue is that edith.xiaohongshu.com needs to allow CORS from www.xiaohongshu.com
# The page's own requests work because they use same-origin or the server allows them
# Our XHR from www.xiaohongshu.com -> edith.xiaohongshu.com IS cross-origin

# The real question: how does the page's own JS make cross-origin requests to edith?
# Answer: sec-fetch-site: same-site (they are same site, not same origin)
# Browser should allow same-site XHR without preflight issues IF the server responds with proper CORS

# Let's try with mode: no-cors fetch instead (but won't get response body)
# Actually let's just try without content-type
js = (
    "new Promise(function(resolve, reject) {"
    "  var xhr = new XMLHttpRequest();"
    "  xhr.open('POST', 'https://edith.xiaohongshu.com/api/sns/web/v1/homefeed');"
    "  xhr.withCredentials = true;"
    # No setRequestHeader!
    "  xhr.onload = function() { resolve(xhr.status + ':' + xhr.responseText.substring(0, 500)); };"
    "  xhr.onerror = function() { reject('error:' + xhr.status); };"
    f"  xhr.send(atob('{b64}'));"
    "})"
)

cdp._id += 1
eval_msg = {"id": cdp._id, "method": "Runtime.evaluate",
            "params": {"expression": js, "awaitPromise": True, "returnByValue": True}}
cdp._ws.send(json.dumps(eval_msg))

# Collect
deadline = time.time() + 15
captured = []
result = None

while time.time() < deadline:
    raw = cdp._ws.recv()
    msg = json.loads(raw)
    if msg.get("method") == "Network.requestWillBeSent":
        req = msg.get("params", {}).get("request", {})
        if "homefeed" in req.get("url", ""):
            captured.append(req)
    if msg.get("id") == cdp._id:
        result = msg
        break

print(f"Captured {len(captured)} request(s)")
for i, req in enumerate(captured):
    print(f"\nRequest {i+1}: {req.get('method')} {req.get('url')}")
    headers = req.get("headers", {})
    for h in ["x-s", "x-s-common", "x-t", "x-rap-param", "content-type", "Origin"]:
        if h in headers:
            print(f"  {h}: {headers[h][:50]}...")

if result:
    val = result.get("result", {}).get("result", {}).get("value", "")
    if val:
        status, body = val.split(":", 1) if ":" in val else (val, "")
        print(f"\nHTTP status: {status}")
        if body:
            try:
                d = json.loads(body)
                print(f"Response: code={d.get('code')} msg={d.get('msg','')} items={len(d.get('data',{}).get('items',[]))}")
            except:
                print(f"Body: {body[:200]}")

cdp.close()
