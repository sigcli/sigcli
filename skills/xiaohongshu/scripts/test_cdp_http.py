#!/usr/bin/env python3
"""Find and use the internal http client that has signing middleware."""
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

# The http client was passed as a.http in plugin install.
# It's likely stored on the Vue app instance or as a global.
# Let's find it through the Vue app's internals.
js = """
(function() {
    var app = document.querySelector('#app').__vue_app__;
    // Check app config
    var gp = app.config.globalProperties;
    var keys = Object.keys(gp);

    // Look for http-like objects
    var httpCandidates = {};
    keys.forEach(function(k) {
        var v = gp[k];
        if (v && typeof v === 'object') {
            if (v.get || v.post || v.request || v.interceptors) {
                httpCandidates[k] = {
                    hasGet: typeof v.get === 'function',
                    hasPost: typeof v.post === 'function',
                    hasRequest: typeof v.request === 'function',
                    hasInterceptors: !!v.interceptors,
                    keys: Object.keys(v).slice(0, 15),
                };
            }
        }
    });

    // Also check $http specifically
    var http = gp.$http || gp.$axios || gp.$api;
    if (http) {
        httpCandidates['$http/$axios/$api'] = {
            hasGet: typeof http.get === 'function',
            hasPost: typeof http.post === 'function',
            interceptors: http.interceptors ? Object.keys(http.interceptors) : null,
        };
    }

    return JSON.stringify({globalPropKeys: keys, httpCandidates: httpCandidates});
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
data = json.loads(val)
print(f"Global properties: {data.get('globalPropKeys')}")
print(f"\nHTTP candidates: {json.dumps(data.get('httpCandidates', {}), indent=2)}")

# If not found on globalProperties, check the app instance itself
js2 = """
(function() {
    var app = document.querySelector('#app').__vue_app__;
    // The 'a' param in install was likely the app context or a plugin context
    // Check _context.app or the root component instance
    var root = app._instance;
    if (!root) return JSON.stringify({error: 'no root instance'});

    // Check root's proxy (exposed properties)
    var proxy = root.proxy;
    var result = {};

    // Common patterns for http client injection
    var checks = ['$http', '$api', '$request', 'http', 'api'];
    checks.forEach(function(k) {
        if (proxy[k]) {
            var v = proxy[k];
            result[k] = {
                type: typeof v,
                hasGet: typeof v.get === 'function',
                hasPost: typeof v.post === 'function',
                keys: typeof v === 'object' ? Object.keys(v).slice(0, 10) : null,
            };
        }
    });

    // Also check inject
    var setupState = root.setupState || {};
    var stateKeys = Object.keys(setupState).filter(function(k) {
        var v = setupState[k];
        return v && typeof v === 'object' && (v.get || v.post);
    });
    result.setupStateHttp = stateKeys;

    return JSON.stringify(result);
})()
"""

r2 = cdp.send("Runtime.evaluate", {"expression": js2, "returnByValue": True})
print(f"\nRoot instance check: {r2.get('result', {}).get('value', '?')}")

cdp.close()
