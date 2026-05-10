#!/usr/bin/env python3
"""Find the signing functions in XHS page context."""
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

# The page hooks XHR and adds x-rap-param via setRequestHeader.
# There must be a function that generates it. Let's intercept it.
# Strategy: monkey-patch XMLHttpRequest.prototype.setRequestHeader and log what's called.

js = """
(function() {
    var captured = {};
    var origOpen = XMLHttpRequest.prototype.open;
    var origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._xhs_url = url;
        this._xhs_method = method;
        this._xhs_headers = {};
        return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        this._xhs_headers[name] = value;
        // Capture signing headers
        if (name === 'x-s' || name === 'x-s-common' || name === 'x-t' || name === 'x-rap-param' || name === 'x-b3-traceid' || name === 'x-xray-traceid') {
            captured[name] = (value || '').substring(0, 80);
        }
        return origSetHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        // After send, store captured headers on window for retrieval
        if (Object.keys(captured).length > 0) {
            window.__xhs_captured_headers__ = JSON.parse(JSON.stringify(captured));
        }
        return origSend.apply(this, arguments);
    };

    // Now trigger a real API call by making a simple XHR
    // The page's interceptor should kick in and add all headers
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://edith.xiaohongshu.com/api/sns/web/v2/user/me');
    xhr.withCredentials = true;
    xhr.send();

    // Wait a moment and return what was captured
    return new Promise(function(resolve) {
        setTimeout(function() {
            resolve(JSON.stringify(window.__xhs_captured_headers__ || captured || {empty: true}));
        }, 2000);
    });
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "awaitPromise": True, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
print(f"Captured signing headers:\n{json.dumps(json.loads(val), indent=2)}")

cdp.close()
