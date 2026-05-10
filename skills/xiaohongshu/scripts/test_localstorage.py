#!/usr/bin/env python3
"""Scan localStorage for b1 fingerprint key."""
import sys
import json
import os
import time
import subprocess
import urllib.request
import websocket

port = 9333
bp = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
dd = os.path.expanduser("~/.sig/browser-data")

# Kill any existing
os.system("pkill -f 'remote-debugging-port' 2>/dev/null")
time.sleep(1)

# Launch
proc = subprocess.Popen([
    bp, f"--remote-debugging-port={port}", f"--user-data-dir={dd}",
    "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*",
    "https://www.xiaohongshu.com/explore"
], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(8)

# Get page WS
targets = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/json").read())
page = next(t for t in targets if t["type"] == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=15)

# Evaluate
js = """
(function() {
    var allKeys = [];
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        allKeys.push(key);
        var value = localStorage.getItem(key);
        data[key] = value.length > 200 ? value.substring(0, 200) + '...[' + value.length + ']' : value;
    }
    return JSON.stringify({count: allKeys.length, keys: allKeys, data: data});
})()
"""
ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": js, "returnByValue": True}}))
while True:
    r = json.loads(ws.recv())
    if r.get("id") == 1:
        val = r.get("result", {}).get("result", {}).get("value", "{}")
        result = json.loads(val)
        print(f"localStorage keys ({result['count']}):")
        for k in result["keys"]:
            print(f"  {k}")
        print(f"\nValues:")
        for k, v in result.get("data", {}).items():
            print(f"  {k}: {v[:150]}")
        break

ws.close()
proc.terminate()
