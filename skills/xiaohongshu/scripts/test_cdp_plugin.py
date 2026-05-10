#!/usr/bin/env python3
"""Inspect ZP plugin and try to call the internal signing pipeline."""
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

# ZP is the plugin. Let's look at its install method and the internal functions
js = """
(function() {
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__sign4__'], {}, function(require) {
        __require = require;
    }]);
    var mod = __require('36385');
    var plugin = mod.ZP;

    // Show install method
    var installSrc = plugin.install.toString().substring(0, 1000);

    // The module source has the sign functions as closures.
    // Let's try a different approach: find the actual axios instance used by the app
    // through the Vue app's plugins or injections.
    var app = document.querySelector('#app').__vue_app__;
    var pinia = app.config.globalProperties.$pinia;

    // Check if there's an http/api injection
    var provides = app._context.provides || {};
    var provideKeys = Object.keys(provides).filter(function(k) {
        var v = provides[k];
        return v && (typeof v.get === 'function' || typeof v.post === 'function' || typeof v.request === 'function');
    });

    return JSON.stringify({
        installSrc: installSrc,
        provideKeys: provideKeys,
        allProvideKeys: Object.keys(provides).slice(0, 30),
    });
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
data = json.loads(val)
print(f"Provide keys with http methods: {data.get('provideKeys')}")
print(f"All provide keys (first 30): {data.get('allProvideKeys')}")
print(f"\nInstall source:\n{data.get('installSrc', '')[:800]}")

cdp.close()
