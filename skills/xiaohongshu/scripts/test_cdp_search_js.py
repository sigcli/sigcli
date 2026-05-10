#!/usr/bin/env python3
"""Search page JS source for x-s, x-rap-param string literals and find the signing function."""
import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser, CdpClient

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)
cdp = CdpClient(state["ws_url"], timeout=30)

# Use Debugger.searchInContent to find "x-rap-param" or "x-s" in loaded scripts
cdp.send("Debugger.enable", {})

# Get all loaded scripts
scripts = []
# We need to collect scriptParsed events - but they were already fired.
# Instead use Runtime to search the source of vendor-dynamic bundle

# Find the script URLs first
js = """
(function() {
    var scripts = document.querySelectorAll('script[src]');
    var urls = [];
    for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].src;
        if (src.includes('vendor-dynamic') || src.includes('4630')) {
            urls.push(src);
        }
    }
    return JSON.stringify(urls);
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
urls = json.loads(r.get("result", {}).get("value", "[]"))
print(f"Found script URLs: {urls}")

# Use Debugger.searchInContent with scriptId
# First get scriptIds for these URLs
# Actually let's use a simpler approach: search in all scripts via CDP
r = cdp.send("Debugger.searchInContent", {
    "scriptId": "0",  # won't work, need actual IDs
    "query": "x-rap-param"
})
print(f"Search result: {r}")

# Alternative: use the page to grep through loaded module source code
js2 = """
(function() {
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__search__'], {}, function(require) {
        __require = require;
    }]);
    if (!__require) return JSON.stringify({error: 'no require'});

    var ids = Object.keys(__require.m || {});
    var found = [];

    for (var i = 0; i < ids.length; i++) {
        var src = __require.m[ids[i]].toString();
        if (src.includes('x-rap-param') || src.includes('"x-s"') || src.includes("'x-s'")) {
            // Found a module that references signing headers
            var snippet = '';
            var idx = src.indexOf('x-rap-param');
            if (idx === -1) idx = src.indexOf('"x-s"');
            if (idx === -1) idx = src.indexOf("'x-s'");
            if (idx >= 0) snippet = src.substring(Math.max(0, idx - 100), idx + 200);
            found.push({id: ids[i], len: src.length, snippet: snippet.substring(0, 300)});
        }
        if (found.length >= 5) break;
    }
    return JSON.stringify(found);
})()
"""
r2 = cdp.send("Runtime.evaluate", {"expression": js2, "returnByValue": True})
val = r2.get("result", {}).get("value", "[]")
results = json.loads(val)
print(f"\nModules referencing signing headers: {len(results)}")
for item in results:
    print(f"\n  Module {item['id']} ({item['len']} chars):")
    print(f"  Snippet: {item['snippet']}")

cdp.close()
