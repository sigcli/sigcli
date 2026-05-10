#!/usr/bin/env python3
"""Find the signing function exposed by XHS webpack modules."""
import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser, CdpClient

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)
cdp = CdpClient(state["ws_url"], timeout=15)

# The webpack modules are loaded via webpackChunkxhs_pc_web.
# We can use webpack's internal require (__webpack_require__) to access any module.
# First, let's find __webpack_require__ or the module cache.

js = """
(function() {
    // webpack stores module cache in a closure, but we can access it
    // via the webpackChunk push mechanism
    var moduleCache = {};
    var originalPush = self.webpackChunkxhs_pc_web.push;

    // Temporarily override push to capture __webpack_require__
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__probe__'], {}, function(require) {
        __require = require;
    }]);

    if (!__require) return JSON.stringify({error: 'could not get webpack require'});

    // Now we have __webpack_require__. Let's look at module IDs.
    // The signing module is likely in chunk 4630 (from the stack trace)
    var moduleIds = Object.keys(__require.m || {}).slice(0, 20);

    // Try to find modules that export signing-related functions
    var results = {};

    // Try known module IDs from the stack trace (4630.xxx chunk has module 9116)
    try {
        var mod9116 = __require(9116);
        results['9116'] = typeof mod9116 === 'object' ? Object.keys(mod9116).slice(0, 10) : typeof mod9116;
    } catch(e) {
        results['9116'] = 'error: ' + e.message;
    }

    // Search for modules that export sign-like functions
    var signModules = [];
    var ids = Object.keys(__require.m || {});
    for (var i = 0; i < ids.length && signModules.length < 5; i++) {
        try {
            var m = __require(ids[i]);
            if (m && typeof m === 'object') {
                var keys = Object.keys(m);
                var hasSign = keys.some(function(k) {
                    return k.toLowerCase().includes('sign') || k.toLowerCase().includes('encrypt') || k.includes('xs') || k.includes('rap');
                });
                if (hasSign) {
                    signModules.push({id: ids[i], keys: keys.slice(0, 15)});
                }
            }
        } catch(e) {}
    }

    return JSON.stringify({
        totalModules: ids.length,
        mod9116: results['9116'],
        signModules: signModules,
    });
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
data = json.loads(val)
print(json.dumps(data, indent=2))

cdp.close()
