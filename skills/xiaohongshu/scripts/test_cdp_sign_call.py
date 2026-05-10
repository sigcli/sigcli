#!/usr/bin/env python3
"""Call window._webmsxyw to generate XHS signing headers!"""
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

# Call _webmsxyw with a test path
js = '(function() { var r = window._webmsxyw("/api/sns/web/v1/homefeed", "{}"); return JSON.stringify(r); })()'
r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value")
print(f"_webmsxyw(\"/homefeed\", \"{{}}\"): {val}")

if val:
    data = json.loads(val)
    print(f"\nKeys: {list(data.keys())}")
    for k, v in data.items():
        print(f"  {k}: {str(v)[:60]}...")

# Now the full test: generate headers for a GET request with params
js2 = '(function() { var r = window._webmsxyw("/api/sns/web/v1/user_posted?num=5&user_id=test123", ""); return JSON.stringify(r); })()'
r2 = cdp.send("Runtime.evaluate", {"expression": js2, "returnByValue": True})
val2 = r2.get("result", {}).get("value")
print(f"\n_webmsxyw(\"/user_posted?...\", \"\"): {val2}")

cdp.close()
