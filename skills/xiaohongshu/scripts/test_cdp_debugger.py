#!/usr/bin/env python3
"""Use CDP Debugger to search ALL loaded scripts for signing functions."""
import sys
import json
import os
import time
import websocket

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)
ws = websocket.create_connection(state["ws_url"], timeout=60)
msg_id = 0

def send_cdp(method, params=None):
    global msg_id
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    while True:
        r = json.loads(ws.recv())
        if r.get("id") == msg_id:
            if "error" in r:
                return {"error": r["error"]}
            return r.get("result", {})
        # Skip events but collect scriptParsed
        if r.get("method") == "Debugger.scriptParsed":
            scripts.append(r["params"])

scripts = []
send_cdp("Debugger.enable")

# Give time for scriptParsed events
time.sleep(2)
# Drain remaining events
ws.settimeout(1)
try:
    while True:
        r = json.loads(ws.recv())
        if r.get("method") == "Debugger.scriptParsed":
            scripts.append(r["params"])
except:
    pass
ws.settimeout(60)

print(f"Total scripts: {len(scripts)}")

# Filter scripts likely containing signing code
target_scripts = [s for s in scripts if "4630" in s.get("url", "") or "vendor-dynamic" in s.get("url", "")]
if not target_scripts:
    # Try all scripts with reasonable size
    target_scripts = [s for s in scripts if s.get("length", 0) > 10000]

print(f"Target scripts to search: {len(target_scripts)}")
for s in target_scripts[:5]:
    print(f"  {s.get('scriptId')}: {s.get('url', '?')[:80]} ({s.get('length', 0)} bytes)")

# Search each for "x-rap-param"
for s in target_scripts[:10]:
    r = send_cdp("Debugger.searchInContent", {
        "scriptId": s["scriptId"],
        "query": "x-rap-param",
    })
    if "error" not in r:
        matches = r.get("result", [])
        if matches:
            print(f"\n  FOUND in {s.get('url', '?')[:60]}:")
            for m in matches[:3]:
                print(f"    Line {m['lineNumber']}: {m['lineContent'][:150]}")

# Also search for "x-s-common"
for s in target_scripts[:10]:
    r = send_cdp("Debugger.searchInContent", {
        "scriptId": s["scriptId"],
        "query": "x-s-common",
    })
    if "error" not in r:
        matches = r.get("result", [])
        if matches:
            print(f"\n  FOUND 'x-s-common' in {s.get('url', '?')[:60]}:")
            for m in matches[:3]:
                print(f"    Line {m['lineNumber']}: {m['lineContent'][:150]}")

ws.close()
print("\nDone.")
