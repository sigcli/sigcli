#!/usr/bin/env python3
"""
Key test: In the browser page (where RAP hijack is installed),
create an XHR and see if x-rap-param gets injected by the hijack.
"""
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

port = _find_free_port()
bp = _get_browser_path()
dd = os.path.expanduser("~/.sig/browser-data")
proc = subprocess.Popen([bp, f"--remote-debugging-port={port}", f"--user-data-dir={dd}",
    "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "about:blank"],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(2)
_wait_for_cdp(port)
targets = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/json").read())
page = next(t for t in targets if t["type"] == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=60)
msg_id = 0

def cmd(m, p=None):
    global msg_id
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": m, "params": p or {}}))
    while True:
        r = json.loads(ws.recv())
        if r.get("id") == msg_id:
            return r.get("result", {})

cmd("Page.navigate", {"url": "https://www.xiaohongshu.com/explore"})
time.sleep(8)

# Confirm RAP hijack is installed
r = cmd("Runtime.evaluate", {"expression": "window.__rap_hijack_installed__", "returnByValue": True})
print(f"RAP hijack installed: {r.get('result', {}).get('value')}")

# Now: create XHR in page context, capture what headers get set BEFORE send
# The RAP hijack patches XHR.prototype.open or .send to inject x-rap-param
js = """
(function() {
    // Capture headers that get set
    var capturedHeaders = {};
    var OrigXHR = window.XMLHttpRequest;
    var xhr = new OrigXHR();

    // Monkey-patch THIS instance's setRequestHeader to capture
    var origSet = xhr.setRequestHeader.bind(xhr);
    xhr.setRequestHeader = function(name, value) {
        capturedHeaders[name] = (value || '').substring(0, 100);
        return origSet(name, value);
    };

    xhr.open('POST', 'https://edith.xiaohongshu.com/api/sns/web/v1/feed');
    xhr.setRequestHeader('content-type', 'application/json;charset=UTF-8');

    // Don't actually send - just see what headers were set after open
    // RAP might inject during open, or it might inject during send
    // Let's check after open first
    var afterOpen = Object.assign({}, capturedHeaders);

    // Now send
    xhr.send('{"source_note_id":"test"}');

    // Check again after send
    var afterSend = Object.assign({}, capturedHeaders);

    return JSON.stringify({
        afterOpen: afterOpen,
        afterSend: afterSend,
        hasRapParam: 'x-rap-param' in capturedHeaders,
    });
})()
"""

r = cmd("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
print(f"\nResult: {val}")

ws.close()
proc.terminate()
