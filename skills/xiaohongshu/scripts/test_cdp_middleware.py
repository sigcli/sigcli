#!/usr/bin/env python3
"""Find the exported middleware function that calls xhsSign internally."""
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

# The signing code is in module 36385's source but not exported directly.
# The exported ZP might be the middleware. Let's check.
# Also let's search more modules nearby.
js = """
(function() {
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__sign3__'], {}, function(require) {
        __require = require;
    }]);

    var mod = __require('36385');

    // ZP is not a function, let's see what it is
    var zpType = typeof mod.ZP;
    var zpValue = null;
    if (zpType === 'object') {
        zpValue = Object.keys(mod.ZP || {}).slice(0, 20);
    } else if (zpType === 'function') {
        zpValue = mod.ZP.toString().substring(0, 300);
    } else {
        zpValue = String(mod.ZP).substring(0, 100);
    }

    // The middleware function is the one that was shown in the source as the generator
    // containing xhsSign. Let's look at the full module source for exports
    var src = __require.m['36385'].toString();

    // Find what's exported - look for patterns like exports.XX = or __webpack_exports__
    var exportMatches = [];
    var re = /exports\["([^"]+)"\]\s*=\s*|exports\.(\w+)\s*=/g;
    var match;
    while ((match = re.exec(src)) !== null && exportMatches.length < 10) {
        exportMatches.push(match[1] || match[2]);
    }

    // Also find the function that contains "xhsSign" - get its name
    var signIdx = src.indexOf('xhsSign(');
    var funcContext = '';
    if (signIdx > 0) {
        // Go backwards to find function name
        funcContext = src.substring(Math.max(0, signIdx - 500), signIdx + 100);
    }

    return JSON.stringify({
        zpType: zpType,
        zpValue: zpValue,
        exportMatches: exportMatches,
        funcContext: funcContext.substring(funcContext.length - 400),
    });
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
data = json.loads(val)
print(f"ZP type: {data.get('zpType')}, value: {data.get('zpValue')}")
print(f"Export matches: {data.get('exportMatches')}")
print(f"\nFunction context around xhsSign:")
print(data.get("funcContext", ""))

cdp.close()
