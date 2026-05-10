#!/usr/bin/env python3
"""Find http client by traversing Vue component tree."""
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

# From the install source: P.use(signAdaptor) where P = a.http.interceptors.dispatch
# The http object has: .interceptors.spam, .interceptors.dispatch, .interceptors.request, .interceptors.response
# And has .get(), .post() methods.
# It was passed into the plugin via the 'a' param.
# Let's look for it through Vue's provide/inject system or app._context.

js = """
(function() {
    var app = document.querySelector('#app').__vue_app__;

    // Walk the component tree to find anyone using http
    function findHttp(vnode, depth) {
        if (depth > 3) return null;
        if (!vnode) return null;

        // Check component instance
        var instance = vnode.component;
        if (instance) {
            var ctx = instance.ctx || {};
            // Check for $http or similar
            if (ctx.$http && ctx.$http.get) return ctx.$http;
            if (ctx.http && ctx.http.get) return ctx.http;

            // Check setupState
            var ss = instance.setupState || {};
            var keys = Object.keys(ss);
            for (var i = 0; i < keys.length; i++) {
                var v = ss[keys[i]];
                if (v && v.interceptors && v.interceptors.dispatch) return v;
            }

            // Check provides
            var provides = instance.provides || {};
            var pkeys = Object.keys(provides);
            for (var i = 0; i < pkeys.length; i++) {
                var v = provides[pkeys[i]];
                if (v && v.interceptors && v.interceptors.dispatch) return v;
            }
        }

        // Check children
        if (vnode.children) {
            for (var i = 0; i < vnode.children.length; i++) {
                var result = findHttp(vnode.children[i], depth + 1);
                if (result) return result;
            }
        }
        return null;
    }

    // Alternative: the http client might be stored during install.
    // install receives (e, a, s) where a is the app context.
    // Let's check if it's accessible via the app's internal plugin state.
    var plugins = app._context.app._plugins || app._context.plugins || [];

    // Actually, the simplest way: check all Vue component instances for http inject
    // Vue 3 stores injects on the instance
    var root = app._instance;
    if (root) {
        // Check root provides
        var provides = root.provides || root.appContext?.provides || {};
        var allProvides = {};
        Object.keys(provides).forEach(function(k) {
            var v = provides[k];
            if (v && typeof v === 'object' && v.interceptors) {
                allProvides[k] = {
                    hasDispatch: !!v.interceptors.dispatch,
                    hasSpam: !!v.interceptors.spam,
                    hasGet: typeof v.get === 'function',
                    hasPost: typeof v.post === 'function',
                };
            }
        });
        if (Object.keys(allProvides).length > 0) {
            return JSON.stringify({found: 'in provides', details: allProvides});
        }
    }

    // Try using Symbol keys (Vue uses Symbols for inject)
    var symbols = Object.getOwnPropertySymbols(app._context.provides || {});
    var symResults = {};
    symbols.forEach(function(sym) {
        var v = app._context.provides[sym];
        if (v && typeof v === 'object') {
            if (v.get || v.post || v.interceptors) {
                symResults[sym.toString()] = {
                    hasGet: typeof v.get === 'function',
                    hasPost: typeof v.post === 'function',
                    hasInterceptors: !!v.interceptors,
                    keys: Object.keys(v).slice(0, 15),
                };
            }
        }
    });

    if (Object.keys(symResults).length > 0) {
        return JSON.stringify({found: 'in symbol provides', details: symResults});
    }

    return JSON.stringify({
        error: 'http client not found',
        rootExists: !!root,
        providesCount: Object.keys(app._context.provides || {}).length,
        symbolCount: symbols.length,
    });
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
print(r.get("result", {}).get("value", "?"))

cdp.close()
