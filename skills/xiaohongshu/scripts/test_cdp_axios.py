#!/usr/bin/env python3
"""Find the axios instance with interceptors that add signing headers."""
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

# Find the axios instance that has request interceptors
js = """
(function() {
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__probe2__'], {}, function(require) {
        __require = require;
    }]);
    if (!__require) return JSON.stringify({error: 'no require'});

    var ids = Object.keys(__require.m || {});
    var axiosInstances = [];

    // Search for modules that export an axios-like instance with interceptors
    for (var i = 0; i < ids.length; i++) {
        try {
            var m = __require(ids[i]);
            if (!m) continue;

            // Check if it's an axios instance (has .interceptors.request)
            if (m.interceptors && m.interceptors.request) {
                var handlers = m.interceptors.request.handlers || [];
                axiosInstances.push({
                    id: ids[i],
                    type: 'direct',
                    interceptorCount: handlers.length,
                    hasGet: typeof m.get === 'function',
                    hasPost: typeof m.post === 'function',
                });
            }
            // Check default export
            if (m.default && m.default.interceptors && m.default.interceptors.request) {
                var handlers2 = m.default.interceptors.request.handlers || [];
                axiosInstances.push({
                    id: ids[i],
                    type: 'default',
                    interceptorCount: handlers2.length,
                    hasGet: typeof m.default.get === 'function',
                    hasPost: typeof m.default.post === 'function',
                });
            }

            if (axiosInstances.length >= 5) break;
        } catch(e) {}
    }

    return JSON.stringify(axiosInstances);
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "[]")
instances = json.loads(val)
print(f"Found {len(instances)} axios instance(s):")
print(json.dumps(instances, indent=2))

# If we found one, try to use it to make a request
if instances:
    best = instances[0]
    print(f"\nTrying to call axios instance (module {best['id']})...")

    js2 = f"""
    (function() {{
        var __require = null;
        self.webpackChunkxhs_pc_web.push([['__probe3__'], {{}}, function(require) {{
            __require = require;
        }}]);
        var axiosInstance = __require('{best['id']}');
        if (axiosInstance.default) axiosInstance = axiosInstance.default;

        return axiosInstance.get('https://edith.xiaohongshu.com/api/sns/web/v2/user/me')
            .then(function(resp) {{
                return JSON.stringify({{
                    status: resp.status,
                    code: resp.data ? resp.data.code : null,
                    nickname: resp.data && resp.data.data ? resp.data.data.nickname : null,
                }});
            }})
            .catch(function(err) {{
                return JSON.stringify({{error: err.message || String(err)}});
            }});
    }})()
    """
    r2 = cdp.send("Runtime.evaluate", {"expression": js2, "awaitPromise": True, "returnByValue": True})
    print(f"Result: {r2.get('result', {}).get('value', '?')}")

cdp.close()
