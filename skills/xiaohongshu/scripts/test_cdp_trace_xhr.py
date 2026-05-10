#!/usr/bin/env python3
"""Use CDP Debugger to trace who sets x-s-common and x-rap-param on XHR."""
import sys
import json
import os
import time
import websocket

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)
ws = websocket.create_connection(state["ws_url"], timeout=30)
msg_id = 0

def send_cmd(method, params=None):
    global msg_id
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    while True:
        r = json.loads(ws.recv())
        if r.get("id") == msg_id:
            return r.get("result", {})
        # Store events for later
        if r.get("method") == "Debugger.paused":
            return {"__paused__": r["params"]}

# Inject a hook that captures the full headers before XHR.send
# This is simpler than breakpoints - just monkey-patch at the right level
js = """
(function() {
    // Intercept the REAL send to capture all headers that were set
    var origSend = XMLHttpRequest.prototype.send;
    var origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    var origOpen = XMLHttpRequest.prototype.open;

    window.__xhs_xhr_log__ = [];

    XMLHttpRequest.prototype.open = function(method, url) {
        this.__xhs_method = method;
        this.__xhs_url = url;
        this.__xhs_headers = {};
        return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        this.__xhs_headers[name.toLowerCase()] = value;
        return origSetHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        if (this.__xhs_url && this.__xhs_url.includes('edith.xiaohongshu.com')) {
            window.__xhs_xhr_log__.push({
                method: this.__xhs_method,
                url: this.__xhs_url,
                headers: Object.assign({}, this.__xhs_headers),
                bodyLen: body ? body.length : 0,
            });
        }
        return origSend.apply(this, arguments);
    };

    return 'hooks installed';
})()
"""

send_cmd("Runtime.evaluate", {"expression": js, "returnByValue": True})
print("XHR hooks installed.")

# Now navigate to trigger XHS's own API calls (which go through their full signing pipeline)
send_cmd("Page.navigate", {"url": "https://www.xiaohongshu.com/explore"})
print("Navigating... waiting for API calls...")
time.sleep(8)

# Read captured XHR logs
js2 = "JSON.stringify(window.__xhs_xhr_log__ || [])"
r = send_cmd("Runtime.evaluate", {"expression": js2, "returnByValue": True})
val = r.get("result", {}).get("value", "[]")
logs = json.loads(val)

print(f"\nCaptured {len(logs)} XHR request(s) to edith:")
for i, log in enumerate(logs[:5]):
    print(f"\n  [{i}] {log['method']} {log['url'][:80]}")
    headers = log.get("headers", {})
    sign_headers = {k: v[:50] + "..." if len(str(v)) > 50 else v
                    for k, v in headers.items()
                    if k in ("x-s", "x-s-common", "x-t", "x-rap-param", "x-b3-traceid", "x-xray-traceid")}
    print(f"      Sign headers: {list(sign_headers.keys())}")
    for k, v in sign_headers.items():
        print(f"        {k}: {v}")

ws.close()
print("\nDone.")
