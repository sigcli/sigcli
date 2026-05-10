#!/usr/bin/env python3
"""Find XHS internal API methods in the page context."""
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

# The call stack showed: getApiSnsWebV1UserPosted -> fetchNotes -> vendor-dynamic
# These are likely exported from a webpack module. Let's search for them.

queries = [
    # Look for the function name directly on window or global scope
    "typeof getApiSnsWebV1UserPosted",
    "typeof window.getApiSnsWebV1UserPosted",
    # Check if there's a global API object
    "typeof window.__xhs_api__",
    "typeof window.__api__",
    # Check Vue app internals
    "!!document.querySelector('#app').__vue_app__",
    # Check webpack chunk names
    "typeof webpackChunkxhs_pc_web",
    "typeof self.webpackChunkxhs_pc_web",
    # Check if there's an exposed request/axios instance
    "typeof window.__axios__",
]

for q in queries:
    r = cdp.send("Runtime.evaluate", {"expression": q, "returnByValue": True})
    val = r.get("result", {}).get("value", "?")
    print(f"{q} = {val}")

# Try to find the internal API via webpack require
# webpack exposes modules via webpackChunkxhs_pc_web
print("\n--- Searching webpack modules ---")
js_search = """
(function() {
    var chunks = self.webpackChunkxhs_pc_web;
    if (!chunks) return 'no webpack chunks';
    return 'chunks: ' + chunks.length;
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js_search, "returnByValue": True})
print(f"Webpack: {r.get('result', {}).get('value', '?')}")

# Try to access the Vue app's internal store/API
js_vue = """
(function() {
    var app = document.querySelector('#app');
    if (!app || !app.__vue_app__) return 'no vue app';
    // Get the app context
    var ctx = app.__vue_app__._context;
    var globalProps = ctx.config.globalProperties;
    var keys = Object.keys(globalProps).filter(function(k) { return k.startsWith('$') || k.startsWith('_'); });
    return JSON.stringify(keys.slice(0, 20));
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js_vue, "returnByValue": True})
print(f"Vue globals: {r.get('result', {}).get('value', '?')}")

cdp.close()
