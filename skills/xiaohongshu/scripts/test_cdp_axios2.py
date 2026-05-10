#!/usr/bin/env python3
"""Deep search: find the actual axios instance XHS uses (with interceptors)."""
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

# Deep search: look through ALL module exports for any object with interceptors.request.handlers > 0
js = """
(function() {
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__probe4__'], {}, function(require) {
        __require = require;
    }]);
    if (!__require) return JSON.stringify({error: 'no require'});

    var ids = Object.keys(__require.m || {});
    var found = [];

    for (var i = 0; i < ids.length; i++) {
        try {
            var m = __require(ids[i]);
            if (!m) continue;
            // Search recursively through exports
            var targets = [m];
            if (m.default) targets.push(m.default);
            // Check named exports
            Object.keys(m).forEach(function(k) {
                if (m[k] && typeof m[k] === 'object') targets.push(m[k]);
            });

            for (var j = 0; j < targets.length; j++) {
                var t = targets[j];
                if (t && t.interceptors && t.interceptors.request && t.interceptors.request.handlers) {
                    var handlers = t.interceptors.request.handlers;
                    var count = handlers.filter(function(h) { return h !== null; }).length;
                    if (count > 0) {
                        found.push({
                            moduleId: ids[i],
                            interceptorCount: count,
                            hasGet: typeof t.get === 'function',
                            hasPost: typeof t.post === 'function',
                            baseURL: t.defaults ? t.defaults.baseURL : null,
                        });
                    }
                }
            }
            if (found.length >= 3) break;
        } catch(e) {}
    }

    return JSON.stringify(found);
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "[]")
found = json.loads(val)
print(f"Axios instances WITH interceptors: {len(found)}")
print(json.dumps(found, indent=2))

if found:
    mod_id = found[0]["moduleId"]
    print(f"\nUsing module {mod_id} to call /user/me...")
    js2 = f"""
    (function() {{
        var __require = null;
        self.webpackChunkxhs_pc_web.push([['__probe5__'], {{}}, function(require) {{
            __require = require;
        }}]);
        var m = __require('{mod_id}');
        // Find the instance with interceptors
        var instance = null;
        var targets = [m, m.default];
        Object.keys(m).forEach(function(k) {{ if (m[k] && typeof m[k] === 'object') targets.push(m[k]); }});
        for (var i = 0; i < targets.length; i++) {{
            var t = targets[i];
            if (t && t.interceptors && t.interceptors.request && t.interceptors.request.handlers) {{
                var count = t.interceptors.request.handlers.filter(function(h) {{ return h !== null; }}).length;
                if (count > 0) {{ instance = t; break; }}
            }}
        }}
        if (!instance) return Promise.resolve(JSON.stringify({{error: 'instance not found'}}));

        return instance.get('/api/sns/web/v2/user/me')
            .then(function(resp) {{
                return JSON.stringify({{
                    status: resp.status,
                    code: resp.data.code,
                    nickname: resp.data.data ? resp.data.data.nickname : null,
                }});
            }})
            .catch(function(err) {{
                return JSON.stringify({{error: err.message, response: err.response ? err.response.data : null}});
            }});
    }})()
    """
    r2 = cdp.send("Runtime.evaluate", {"expression": js2, "awaitPromise": True, "returnByValue": True})
    print(f"Result: {r2.get('result', {}).get('value', '?')}")

cdp.close()
