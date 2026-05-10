#!/usr/bin/env python3
"""Use CDP Fetch domain to intercept and observe request headers."""
import sys
import json
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser, CdpClient
import websocket

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)

# Use raw websocket for event handling
ws = websocket.create_connection(state["ws_url"], timeout=30)
msg_id = 0

def send_cdp(method, params=None):
    global msg_id
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    # Wait for response (skip events)
    while True:
        r = json.loads(ws.recv())
        if r.get("id") == msg_id:
            return r.get("result", {})

# Enable Fetch domain to intercept requests to edith
send_cdp("Fetch.enable", {
    "patterns": [{"urlPattern": "*edith.xiaohongshu.com*", "requestStage": "Request"}]
})

# Now trigger a request - use a simple eval to make XHR
js = """
(function() {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://edith.xiaohongshu.com/api/sns/web/v1/homefeed');
    xhr.withCredentials = true;
    xhr.setRequestHeader('content-type', 'application/json;charset=UTF-8');
    xhr.send(JSON.stringify({"num":3,"refresh_type":1,"note_index":0,"cursor_score":"","unread_begin_note_id":"","unread_end_note_id":"","unread_note_count":0,"category":"homefeed_recommend"}));
})()
"""
msg_id += 1
ws.send(json.dumps({"id": msg_id, "method": "Runtime.evaluate", "params": {"expression": js}}))

# Now listen for Fetch.requestPaused events
print("Waiting for intercepted request...")
deadline = time.time() + 10
while time.time() < deadline:
    try:
        raw = ws.recv()
        msg = json.loads(raw)
        if msg.get("method") == "Fetch.requestPaused":
            req = msg["params"]["request"]
            print(f"\nIntercepted: {req['method']} {req['url']}")
            print("Headers:")
            for k, v in sorted(req.get("headers", {}).items()):
                display = v[:60] + "..." if len(str(v)) > 60 else v
                print(f"  {k}: {display}")

            # Check for signing headers
            headers = req.get("headers", {})
            print(f"\n  x-s present: {'x-s' in headers}")
            print(f"  x-s-common present: {'x-s-common' in headers}")
            print(f"  x-t present: {'x-t' in headers}")
            print(f"  x-rap-param present: {'x-rap-param' in headers}")

            # Continue the request
            request_id = msg["params"]["requestId"]
            msg_id += 1
            ws.send(json.dumps({"id": msg_id, "method": "Fetch.continueRequest", "params": {"requestId": request_id}}))
            break
    except websocket.WebSocketTimeoutException:
        break

ws.close()
print("\nDone.")
