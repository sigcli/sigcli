#!/usr/bin/env python3
"""Extract the signing code from vendor-dynamic and find callable functions."""
import sys
import json
import os
import re
import time
import websocket

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)
ws = websocket.create_connection(state["ws_url"], timeout=60)
msg_id = 0

def send_cdp(method, params=None):
    global msg_id
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    while True:
        r = json.loads(ws.recv())
        if r.get("id") == msg_id:
            if "error" in r:
                return {"error": r["error"]}
            return r.get("result", {})

send_cdp("Debugger.enable")
time.sleep(1)
# drain events
ws.settimeout(1)
try:
    while True: ws.recv()
except: pass
ws.settimeout(60)

# Get the vendor-dynamic script source (ID 14 from previous run)
# Actually, let's find it by URL
scripts_r = send_cdp("Runtime.evaluate", {
    "expression": "JSON.stringify(performance.getEntriesByType('resource').filter(e => e.name.includes('vendor-dynamic')).map(e => e.name))",
    "returnByValue": True,
})
print(f"Vendor URL: {scripts_r}")

# The code with x-s-common is in the vendor bundle.
# Let's search for the pattern around "x-s-common" assignment.
# We know it's in a webpack module. Let's evaluate in page to find the signing function.

# From the call stack we saw: the signing happens in the axios adapter.
# The adapter calls a JSVMP function (4630 chunk, _garp_2846).
# But there must be a wrapper function that takes (url, data) and returns {x-s, x-s-common, x-t}.
# Let's find it by searching the vendor-dynamic source around "x-s-common"

js = """
(function() {
    // Get the source of the module that contains x-s-common
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__search3__'], {}, function(require) {
        __require = require;
    }]);
    if (!__require) return JSON.stringify({error: 'no require'});

    // Search in module source code for "x-s-common" - check ALL chunks including async ones
    var ids = Object.keys(__require.m || {});
    var signModule = null;
    var signModuleId = null;

    for (var i = 0; i < ids.length; i++) {
        var src = __require.m[ids[i]].toString();
        if (src.includes('x-s-common')) {
            signModule = src;
            signModuleId = ids[i];
            break;
        }
    }

    if (!signModule) {
        // It might be in a module that uses a different string format
        for (var i = 0; i < ids.length; i++) {
            var src = __require.m[ids[i]].toString();
            if (src.includes('xsCommon') || src.includes('xs_common') || src.includes('XSCommon')) {
                signModule = src;
                signModuleId = ids[i];
                break;
            }
        }
    }

    if (!signModule) return JSON.stringify({error: 'signing module not found', totalModules: ids.length});

    // Extract context around the signing references
    var snippets = [];
    var searches = ['x-s-common', 'x-s', 'x-t', 'xsCommon', 'xs_common'];
    for (var s = 0; s < searches.length; s++) {
        var idx = signModule.indexOf(searches[s]);
        if (idx >= 0) {
            snippets.push({
                search: searches[s],
                context: signModule.substring(Math.max(0, idx - 200), idx + 300)
            });
        }
    }

    return JSON.stringify({
        moduleId: signModuleId,
        moduleLen: signModule.length,
        snippets: snippets.slice(0, 5),
    });
})()
"""

r = send_cdp("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
data = json.loads(val)
print(f"\nSign module: {data.get('moduleId')} ({data.get('moduleLen')} chars)")
for s in data.get("snippets", []):
    print(f"\n--- '{s['search']}' ---")
    print(s["context"][:400])

ws.close()
