#!/usr/bin/env python3
"""Extract signAdaptor from module scope and call it to generate headers."""
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

# From the install source we know window[R.ou] etc are set.
# Let's find what window globals XHS set during init
js = """
(function() {
    // Check XHS-specific window globals
    var xhsGlobals = {};
    var candidates = ['__xhs_appId__', '__xhs_webBuild__', '__xhs_platform__'];
    // From install: window[R.ou]=M.appId, window[R.Ji]="6.9.1", etc
    // R is likely an enum with obfuscated keys. Let's just find all window keys that look XHS-related
    var allKeys = Object.keys(window).filter(function(k) {
        return k.startsWith('__') && !k.startsWith('__vue') && !k.startsWith('__webpack');
    });
    allKeys.forEach(function(k) {
        var v = window[k];
        if (typeof v === 'string' || typeof v === 'number') {
            xhsGlobals[k] = v;
        } else if (typeof v === 'function') {
            xhsGlobals[k] = 'function: ' + v.name;
        } else if (typeof v === 'object' && v !== null) {
            xhsGlobals[k] = 'object: ' + Object.keys(v).slice(0, 5).join(',');
        }
    });
    return JSON.stringify(xhsGlobals);
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
data = json.loads(val)
print("XHS window globals:")
for k, v in sorted(data.items()):
    print(f"  {k}: {v}")

cdp.close()
