#!/usr/bin/env python3
"""Try calling the page's internal API directly via Vue component methods."""
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
cdp = CdpClient(state["ws_url"], timeout=30)

# Navigate to a user profile page - this will trigger the internal API
# and we can intercept the response via Network domain
print("Navigating to user profile...")
cdp.send("Network.enable", {})
cdp.send("Page.navigate", {"url": "https://www.xiaohongshu.com/user/profile/5f84695f0000000001008c8d"})

# Wait and collect network responses
time.sleep(8)

# Now use Network.searchInResponseBody or check requestIds
# Actually, let's just collect all completed requests
js_check = """
(function() {
    return document.title;
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js_check, "returnByValue": True})
print(f"Page title: {r.get('result', {}).get('value', '?')}")

# The page made API calls on its own. Let's read the __INITIAL_STATE__ or
# any data that was loaded by the page's own JS
js_user = """
(function() {
    var app = document.querySelector('#app');
    if (!app || !app.__vue_app__) return JSON.stringify({error: 'no vue'});
    var pinia = app.__vue_app__.config.globalProperties.$pinia;
    var userState = pinia.state.value.user || {};
    // Get relevant user data
    return JSON.stringify({
        keys: Object.keys(userState).slice(0, 20),
        userPageData: Object.keys(userState.userPageData || {}),
        notesCount: (userState.notes || []).length,
    });
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js_user, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
print(f"User store: {val}")

# Try to get the actual notes from the store
js_notes = """
(function() {
    var app = document.querySelector('#app').__vue_app__;
    var pinia = app.config.globalProperties.$pinia;
    var userState = pinia.state.value.user || {};
    var notes = userState.notes || [];
    // notes might be nested arrays (pages)
    var flat = [];
    notes.forEach(function(page) {
        if (Array.isArray(page)) {
            page.forEach(function(n) { if (n && n.note_card) flat.push(n); });
        } else if (page && page.note_card) {
            flat.push(page);
        }
    });
    if (flat.length === 0) return JSON.stringify({count: 0, raw_type: typeof notes[0], raw_len: notes.length});
    return JSON.stringify({
        count: flat.length,
        first_title: flat[0].note_card.display_title || flat[0].note_card.title || '?',
        first_id: flat[0].note_card.note_id || flat[0].id || '?',
    });
})()
"""
r = cdp.send("Runtime.evaluate", {"expression": js_notes, "returnByValue": True})
print(f"Notes: {r.get('result', {}).get('value', '?')}")

cdp.close()
print("Done.")
