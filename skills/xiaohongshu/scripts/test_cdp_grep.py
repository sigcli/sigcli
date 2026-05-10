#!/usr/bin/env python3
"""Search webpack modules for signing header strings."""
import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser, CdpClient

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)
cdp = CdpClient(state["ws_url"], timeout=60)

js = """
(function() {
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__search2__'], {}, function(require) {
        __require = require;
    }]);
    if (!__require) return JSON.stringify({error: 'no require'});

    var ids = Object.keys(__require.m || {});
    var found = [];

    for (var i = 0; i < ids.length; i++) {
        var src = __require.m[ids[i]].toString();
        if (src.includes('x-rap-param') || src.includes('"x-s"') || src.includes("'x-s'") || src.includes('"x-s-common"')) {
            var snippet = '';
            var patterns = ['x-rap-param', '"x-s"', "'x-s'", '"x-s-common"'];
            for (var p = 0; p < patterns.length; p++) {
                var idx = src.indexOf(patterns[p]);
                if (idx >= 0) {
                    snippet = src.substring(Math.max(0, idx - 150), idx + 250);
                    break;
                }
            }
            found.push({id: ids[i], len: src.length, snippet: snippet.substring(0, 400)});
        }
        if (found.length >= 10) break;
    }
    return JSON.stringify(found);
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "[]")
results = json.loads(val)
print(f"Modules referencing signing headers: {len(results)}")
for item in results:
    print(f"\n{'='*60}")
    print(f"Module {item['id']} ({item['len']} chars):")
    print(f"{item['snippet']}")

cdp.close()
