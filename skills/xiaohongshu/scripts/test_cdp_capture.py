#!/usr/bin/env python3
"""Capture actual XHR request headers to see what's missing."""
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

# Enable network to capture request headers
cdp.send("Network.enable", {})

# Fire a simple XHR to homefeed and capture what headers are actually sent
body = json.dumps({"num": 3, "refresh_type": 1, "note_index": 0, "cursor_score": "",
    "unread_begin_note_id": "", "unread_end_note_id": "",
    "unread_note_count": 0, "category": "homefeed_recommend"}, separators=(",", ":"))
b64 = base64.b64encode(body.encode()).decode()

js = (
    "new Promise(function(resolve, reject) {"
    "  var xhr = new XMLHttpRequest();"
    "  xhr.open('POST', 'https://edith.xiaohongshu.com/api/sns/web/v1/homefeed');"
    "  xhr.withCredentials = true;"
    "  xhr.setRequestHeader('content-type', 'application/json;charset=UTF-8');"
    "  xhr.onload = function() { resolve(xhr.responseText); };"
    "  xhr.onerror = function() { reject('error:' + xhr.status); };"
    f"  xhr.send(atob('{b64}'));"
    "})"
)

# Send the XHR
cdp._id += 1
eval_msg = {"id": cdp._id, "method": "Runtime.evaluate",
            "params": {"expression": js, "awaitPromise": True, "returnByValue": True}}
cdp._ws.send(json.dumps(eval_msg))

# Collect responses and events
request_headers = None
eval_result = None
deadline = time.time() + 15

while time.time() < deadline:
    raw = cdp._ws.recv()
    msg = json.loads(raw)

    # Network.requestWillBeSent — capture the request headers
    if msg.get("method") == "Network.requestWillBeSent":
        req = msg.get("params", {}).get("request", {})
        url = req.get("url", "")
        if "homefeed" in url:
            request_headers = req.get("headers", {})
            print(f"\n=== Captured request to: {url} ===")
            print("Headers sent:")
            for k, v in sorted(request_headers.items()):
                display = v[:60] + "..." if len(v) > 60 else v
                print(f"  {k}: {display}")

    # Eval response
    if msg.get("id") == cdp._id:
        eval_result = msg
        break

if eval_result:
    val = eval_result.get("result", {}).get("result", {}).get("value", "")
    if val:
        data = json.loads(val)
        print(f"\nResponse: code={data.get('code')} msg={data.get('msg','')}")
    else:
        print(f"\nEval result: {json.dumps(eval_result)[:300]}")
else:
    print("\nTimeout waiting for response")

# Key question: does the captured request have x-s, x-s-common, x-t, x-rap-param?
if request_headers:
    print(f"\n=== Signing headers present? ===")
    for h in ["x-s", "x-s-common", "x-t", "x-b3-traceid", "x-rap-param"]:
        print(f"  {h}: {'YES' if h in request_headers else 'NO'}")

cdp.close()
