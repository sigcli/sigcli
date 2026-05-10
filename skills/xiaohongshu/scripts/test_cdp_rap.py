#!/usr/bin/env python3
"""Find x-rap-param generation in browser page context."""
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

# Navigate
cmd("Page.navigate", {"url": "https://www.xiaohongshu.com/explore"})
time.sleep(8)

# Search for rap-related globals
js = """
(function() {
    var results = {};
    // Check all window keys containing 'rap'
    Object.keys(window).forEach(function(k) {
        if (k.toLowerCase().includes('rap')) {
            var v = window[k];
            results[k] = typeof v === 'function' ? 'function(' + v.length + ' args)' :
                         typeof v === 'string' ? v :
                         typeof v === 'object' ? 'object:' + Object.keys(v || {}).slice(0,5).join(',') :
                         String(v);
        }
    });

    // Also check if there's a way to trigger rap param generation
    // The XHR hook from earlier showed x-rap-param was set via setRequestHeader
    // So the page must have a function that generates it
    // Check if it's in the webpack chunk for 4630
    var __require = null;
    try {
        self.webpackChunkxhs_pc_web.push([['__rap__'], {}, function(require) {
            __require = require;
        }]);
    } catch(e) {}

    if (__require) {
        // Search module source for "x-rap-param" or "rap" generation
        var ids = Object.keys(__require.m || {});
        var rapModules = [];
        for (var i = 0; i < ids.length; i++) {
            var src = __require.m[ids[i]].toString();
            if (src.includes('rap-param') || src.includes('rapParam') || src.includes('__rap_app_id__')) {
                rapModules.push({id: ids[i], len: src.length});
            }
            if (rapModules.length >= 5) break;
        }
        results.__rapModules = rapModules;
    }

    return JSON.stringify(results);
})()
"""

r = cmd("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
data = json.loads(val)
print("RAP-related findings:")
print(json.dumps(data, indent=2))

ws.close()
proc.terminate()
