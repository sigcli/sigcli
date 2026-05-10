#!/usr/bin/env python3
"""Dig into Vue/Pinia to find and call internal API methods."""
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

# Get pinia store IDs
js = """
(function() {
    var app = document.querySelector('#app').__vue_app__;
    var pinia = app.config.globalProperties.$pinia;
    var storeIds = Object.keys(pinia.state.value);
    return JSON.stringify(storeIds);
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
print(f"Pinia stores: {r.get('result', {}).get('value', '?')}")

# Get the search/user store and find API methods
js2 = """
(function() {
    var app = document.querySelector('#app').__vue_app__;
    var pinia = app.config.globalProperties.$pinia;
    // List all store IDs that might have API calls
    var ids = Object.keys(pinia.state.value);
    var result = {};
    // For each store, try to get its actions
    ids.forEach(function(id) {
        var store = pinia._s.get(id);
        if (store) {
            var actions = Object.keys(store).filter(function(k) {
                return typeof store[k] === 'function' && (k.toLowerCase().includes('fetch') || k.toLowerCase().includes('api') || k.toLowerCase().includes('get') || k.toLowerCase().includes('search'));
            });
            if (actions.length > 0) {
                result[id] = actions.slice(0, 10);
            }
        }
    });
    return JSON.stringify(result);
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js2, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
stores = json.loads(val)
print(f"\nStores with API methods:")
for store_id, methods in stores.items():
    print(f"  {store_id}: {methods}")

cdp.close()
