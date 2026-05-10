#!/usr/bin/env python3
"""Find all signing-related global functions: x-s-common, x-rap-param."""
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

# We found _webmsxyw for X-s + X-t.
# Now find x-s-common generator. From Spider_XHS we know the main JS also generates x-s-common.
# Let's check for common XHS global functions.
checks = [
    "typeof window._webmsxyw",
    "typeof window._webmsxxc",  # x-s-common maybe?
    "typeof window._xhsXsCommon",
    "typeof window.__generateXsc",
    "typeof window._generateXsCommon",
    # From the module search, xsCommon was called as xsCommon(e, a)
    # It might use a different window function
    # Let's also check what the _webmsxyw function source looks like
    "window._webmsxyw.toString().length",
    # Check for rap-related
    "typeof window.__rap_report__",
    "typeof window.__generateRap",
    "typeof window._webmsxxr",  # rap maybe?
]

for c in checks:
    r = cdp.send("Runtime.evaluate", {"expression": c, "returnByValue": True})
    v = r.get("result", {}).get("value", "?")
    if v != "undefined" and v != "?":
        print(f"  {c} = {v}")

# Let's also search all window functions that start with _webms or __
js = """
(function() {
    var fns = [];
    Object.keys(window).forEach(function(k) {
        if ((k.startsWith('_webms') || k.startsWith('__xhs') || k.startsWith('_xhs')) && typeof window[k] === 'function') {
            fns.push(k);
        }
    });
    return JSON.stringify(fns);
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
print(f"\nXHS-related functions: {r.get('result', {}).get('value', '?')}")

cdp.close()
