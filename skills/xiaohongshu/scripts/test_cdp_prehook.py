#!/usr/bin/env python3
"""Inject XHR hook BEFORE page load to capture all signing headers."""
import sys
import json
import os
import time
import websocket

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import _find_free_port, _get_browser_path, _wait_for_cdp, _parse_cookies

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

import subprocess, signal

# Launch fresh browser
port = _find_free_port()
browser_path = _get_browser_path()
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
time.sleep(2)

ws_url = _wait_for_cdp(port)

# Connect to browser, get page target
import urllib.request
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

# CRITICAL: inject hook BEFORE navigation so it persists across page loads
hook_js = """
(function() {
    window.__xhs_captured_requests__ = [];
    var origOpen = XMLHttpRequest.prototype.open;
    var origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this.__m = method;
        this.__u = url;
        this.__h = {};
        return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        this.__h[name.toLowerCase()] = (value || '').substring(0, 200);
        return origSetHeader.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
        if (this.__u && this.__u.includes('edith.xiaohongshu.com')) {
            window.__xhs_captured_requests__.push({
                method: this.__m,
                url: this.__u.substring(0, 120),
                headers: Object.assign({}, this.__h),
            });
        }
        return origSend.apply(this, arguments);
    };
})();
"""

cmd("Page.addScriptToEvaluateOnNewDocument", {"source": hook_js})
print("Hook injected (persists across navigations)")

# Now navigate to XHS
cmd("Page.navigate", {"url": "https://www.xiaohongshu.com/explore"})
print("Navigating to XHS...")
time.sleep(10)

# Read captured requests
r = cmd("Runtime.evaluate", {"expression": "JSON.stringify(window.__xhs_captured_requests__ || [])", "returnByValue": True})
val = r.get("result", {}).get("value", "[]")
logs = json.loads(val)
print(f"\nCaptured {len(logs)} API request(s):")

for i, log in enumerate(logs[:5]):
    print(f"\n[{i}] {log['method']} {log['url']}")
    h = log.get("headers", {})
    for key in ["x-s", "x-s-common", "x-t", "x-rap-param", "x-b3-traceid"]:
        if key in h:
            print(f"  {key}: {h[key][:60]}...")

ws.close()
proc.terminate()
print("\nDone.")
