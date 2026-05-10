#!/usr/bin/env python3
"""POC v4: Fresh profile + proxy for browser + direct HTTP with same proxy."""
import sys
import json
import os
import time
import random
import websocket
import subprocess
import urllib.request

import execjs
import requests as http_requests

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

# --- Launch browser with proxy + fresh profile ---
port = 9555
bp = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
dd = os.path.expanduser("~/.sig/xhs-proxy-profile")
proxy = "socks5://127.0.0.1:3333"

os.system("pkill -f 'remote-debugging-port' 2>/dev/null")
os.system(f"rm -rf {dd} 2>/dev/null")
time.sleep(1)

proc = subprocess.Popen([bp, f"--remote-debugging-port={port}", f"--user-data-dir={dd}",
    f"--proxy-server={proxy}",
    "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "about:blank"],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(3)

for _ in range(20):
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version")
        break
    except:
        time.sleep(0.5)

targets = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/json").read())
page = next(t for t in targets if t["type"] == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=60)
msg_id = 0

def cmd(m, p=None):
    global msg_id
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": m, "params": p or {}}))
    while True:
        r = json.loads(ws.recv())
        if r.get("id") == msg_id:
            return r.get("result", {})

# Inject cookies before navigate
for part in cookie.split(";"):
    part = part.strip()
    if "=" in part:
        k, _, v = part.partition("=")
        cmd("Network.setCookie", {"name": k.strip(), "value": v.strip(), "domain": ".xiaohongshu.com", "path": "/"})

# Navigate
cmd("Network.enable")
cmd("Page.navigate", {"url": "https://www.xiaohongshu.com/explore"})

xs_common = None
deadline = time.time() + 20
ws.settimeout(1)
while time.time() < deadline:
    try:
        msg = json.loads(ws.recv())
        if msg.get("method") == "Network.requestWillBeSent":
            headers = msg["params"].get("request", {}).get("headers", {})
            if "X-S-Common" in headers and len(headers["X-S-Common"]) > 500:
                xs_common = headers["X-S-Common"]
                break
    except websocket.WebSocketTimeoutException:
        continue

ws.settimeout(60)
if not xs_common:
    print("ERROR: no X-S-Common"); proc.terminate(); sys.exit(1)
print(f"X-S-Common: {len(xs_common)} chars")

time.sleep(5)

# X-s + X-t
target_path = "/api/sns/web/v1/user_posted?num=5&cursor=&user_id=5f84695f0000000001008c8d&image_scenes=FD_WM_WEBP"
r = cmd("Runtime.evaluate", {"expression": f'JSON.stringify(window._webmsxyw("{target_path}", ""))', "returnByValue": True})
sign = json.loads(r.get("result", {}).get("value", "{}"))
xs = sign.get("X-s", "")
xt = str(sign.get("X-t", ""))
print(f"X-s: {xs[:30]}... X-t: {xt}")

ws.close()
proc.terminate()

# x-rap-param
js_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "xhs_rap.js")
with open(js_path, "r") as f:
    rap_ctx = execjs.compile(f.read())
x_rap = rap_ctx.call("generate_x_rap_param", target_path, "")
print(f"x-rap-param: {x_rap[:30]}...")

# HTTP request (also through proxy to match IP)
url = f"https://edith.xiaohongshu.com{target_path}"
headers = {
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0",
    "cookie": cookie,
    "origin": "https://www.xiaohongshu.com",
    "referer": "https://www.xiaohongshu.com/",
    "accept": "application/json, text/plain, */*",
    "X-s": xs,
    "X-t": xt,
    "X-S-Common": xs_common,
    "x-rap-param": x_rap,
    "x-b3-traceid": "".join("abcdef0123456789"[random.randint(0,15)] for _ in range(16)),
}

proxies = {"https": "socks5h://127.0.0.1:3333", "http": "socks5h://127.0.0.1:3333"}
resp = http_requests.get(url, headers=headers, proxies=proxies, timeout=15)
data = resp.json()
print(f"\nStatus: {resp.status_code}, code: {data.get('code')}, msg: {data.get('msg','')}")
notes = data.get("data", {}).get("notes", [])
print(f"Notes: {len(notes)}")
if notes:
    print(f"  First: {notes[0].get('display_title', '?')}")
