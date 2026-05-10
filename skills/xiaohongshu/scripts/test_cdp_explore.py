#!/usr/bin/env python3
"""Explore what data is available in the XHS page after navigation."""
import sys
import json
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser, CdpClient

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)
cdp = CdpClient(state["ws_url"], timeout=15)

# Navigate to search page
print("Navigating to search page...")
cdp.send("Page.navigate", {"url": "https://www.xiaohongshu.com/search_result?keyword=Python&source=web_search_result_notes"})
time.sleep(6)

# Check page
r = cdp.send("Runtime.evaluate", {"expression": "document.title", "returnByValue": True})
print(f"Title: {r.get('result',{}).get('value','?')}")

# Check __INITIAL_STATE__.search structure
js_check = """
(function() {
    var s = window.__INITIAL_STATE__;
    if (!s) return 'no __INITIAL_STATE__';
    var search = s.search || {};
    return JSON.stringify({
        keys: Object.keys(search),
        feedsLen: (search.feeds || []).length,
        notesLen: (search.notes || []).length,
        itemsLen: (search.items || []).length,
    });
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js_check, "returnByValue": True})
print(f"Search state: {r.get('result',{}).get('value','?')}")

# Try to access Vue/Pinia store (XHS uses Vue 3)
js_pinia = """
(function() {
    // Vue 3 apps mount on #app, we can access internal state
    var app = document.querySelector('#app');
    if (!app || !app.__vue_app__) return 'no vue app';
    var pinia = app.__vue_app__.config.globalProperties.$pinia;
    if (!pinia) return 'no pinia';
    var storeIds = Object.keys(pinia.state.value || {});
    return JSON.stringify(storeIds);
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js_pinia, "returnByValue": True})
print(f"Pinia stores: {r.get('result',{}).get('value','?')}")

# Check DOM for rendered search results
js_dom = """
(function() {
    var items = document.querySelectorAll('.note-item');
    if (items.length > 0) return 'note-item: ' + items.length;
    items = document.querySelectorAll('[class*=note]');
    if (items.length > 0) return 'note-class: ' + items.length;
    items = document.querySelectorAll('.feeds-container');
    if (items.length > 0) return 'feeds-container found, children: ' + items[0].children.length;
    // Try sections
    items = document.querySelectorAll('section');
    return 'sections: ' + items.length;
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js_dom, "returnByValue": True})
print(f"DOM check: {r.get('result',{}).get('value','?')}")

cdp.close()
print("Done.")
