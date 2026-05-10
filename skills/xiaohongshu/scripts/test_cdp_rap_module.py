#!/usr/bin/env python3
"""Inspect module 28663 (rap-param generator) and try to call it."""
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

# Inspect module 28663
js = """
(function() {
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__rap2__'], {}, function(require) {
        __require = require;
    }]);
    var mod = __require('28663');
    var keys = Object.keys(mod);
    var result = {keys: keys};

    // Check each export
    keys.forEach(function(k) {
        var v = mod[k];
        if (typeof v === 'function') {
            result['fn_' + k] = {args: v.length, src: v.toString().substring(0, 300)};
        } else {
            result['val_' + k] = typeof v;
        }
    });

    // Also look for the source snippet around __rap_app_id__
    var src = __require.m['28663'].toString();
    var idx = src.indexOf('__rap_app_id__');
    if (idx >= 0) {
        result.rapContext = src.substring(Math.max(0, idx - 100), idx + 300);
    }

    return JSON.stringify(result);
})()
"""

r = cmd("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
data = json.loads(val)
print(f"Module 28663 keys: {data.get('keys')}")
for k, v in data.items():
    if k.startswith("fn_"):
        print(f"\n  {k}: args={v['args']}")
        print(f"    src: {v['src'][:200]}")
if "rapContext" in data:
    print(f"\nRAP context:\n{data['rapContext'][:400]}")

ws.close()
proc.terminate()
