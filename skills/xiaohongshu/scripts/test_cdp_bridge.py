#!/usr/bin/env python3
"""Find xhrByBridgeAdapter - the custom axios adapter that handles signing."""
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

# Search all modules for something containing "bridge" or "xhrByBridge"
js = """
(function() {
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__probe6__'], {}, function(require) {
        __require = require;
    }]);
    if (!__require) return JSON.stringify({error: 'no require'});

    var ids = Object.keys(__require.m || {});
    var found = [];

    for (var i = 0; i < ids.length; i++) {
        try {
            var m = __require(ids[i]);
            if (!m) continue;
            var keys = Object.keys(m);
            // Look for bridge-related exports
            var bridgeKeys = keys.filter(function(k) {
                return k.toLowerCase().includes('bridge') ||
                       k.toLowerCase().includes('xhrby') ||
                       k.toLowerCase().includes('dispatch') ||
                       k.toLowerCase().includes('adapter');
            });
            if (bridgeKeys.length > 0) {
                found.push({id: ids[i], bridgeKeys: bridgeKeys, allKeys: keys.slice(0, 10)});
            }
            if (found.length >= 10) break;
        } catch(e) {}
    }

    // Also: check if we can find the configured axios instance used by the app
    // The app's API module likely has an axios instance with a custom adapter
    var adapterModules = [];
    for (var i = 0; i < ids.length && adapterModules.length < 5; i++) {
        try {
            var m = __require(ids[i]);
            if (!m) continue;
            var targets = [m, m.default];
            for (var j = 0; j < targets.length; j++) {
                var t = targets[j];
                if (t && t.defaults && t.defaults.adapter && typeof t.defaults.adapter === 'function') {
                    adapterModules.push({
                        id: ids[i],
                        adapterName: t.defaults.adapter.name || 'anonymous',
                        baseURL: t.defaults.baseURL || null,
                    });
                }
            }
        } catch(e) {}
    }

    return JSON.stringify({bridgeModules: found, adapterModules: adapterModules});
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
data = json.loads(val)
print("Bridge modules:", json.dumps(data.get("bridgeModules", []), indent=2))
print("\nAdapter modules:", json.dumps(data.get("adapterModules", []), indent=2))

# If we found adapter modules, try using one
adapters = data.get("adapterModules", [])
if adapters:
    mod_id = adapters[0]["id"]
    print(f"\nCalling module {mod_id} (has custom adapter)...")
    js2 = f"""
    (function() {{
        var __require = null;
        self.webpackChunkxhs_pc_web.push([['__probe7__'], {{}}, function(require) {{
            __require = require;
        }}]);
        var m = __require('{mod_id}');
        var instance = m.default || m;
        return instance.get('/api/sns/web/v2/user/me')
            .then(function(resp) {{
                return JSON.stringify({{status: resp.status, code: resp.data.code, nickname: resp.data.data ? resp.data.data.nickname : null}});
            }})
            .catch(function(err) {{
                return JSON.stringify({{error: err.message}});
            }});
    }})()
    """
    r2 = cdp.send("Runtime.evaluate", {"expression": js2, "awaitPromise": True, "returnByValue": True})
    print(f"Result: {r2.get('result', {}).get('value', '?')}")

cdp.close()
