#!/usr/bin/env python3
"""Final POC: xhshow(with b1) + execjs(x-rap-param) + HTTP request."""
import sys
import json
import os
import time
import math
import random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import execjs
import requests
from xhshow import CryptoConfig, SessionManager, Xhshow

# --- Config ---
XHS_API = "https://edith.xiaohongshu.com"
CHROME_VERSION = "145"
USER_AGENT = f"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{CHROME_VERSION}.0.0.0 Safari/537.36"
SDK_VERSION = "4.2.6"
APP_ID = "xhs-pc-web"
PLATFORM = "macOS"

# --- Load env ---
cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
b1 = os.environ.get("SIG_XIAOHONGSHU_B1", "")
if not cookie:
    print(json.dumps({"error": "AUTH_REQUIRED"})); sys.exit(1)

# Parse cookies
sign_cookies = {}
for part in cookie.split(";"):
    part = part.strip()
    if "=" in part:
        k, _, v = part.partition("=")
        sign_cookies[k.strip()] = v.strip()

print(f"Cookie keys: {len(sign_cookies)}, b1 length: {len(b1)}")

# --- Setup xhshow with proper config ---
config = CryptoConfig().with_overrides(
    PUBLIC_USERAGENT=USER_AGENT,
    SIGNATURE_DATA_TEMPLATE={"x0": SDK_VERSION, "x1": APP_ID, "x2": PLATFORM, "x3": "", "x4": ""},
    SIGNATURE_XSCOMMON_TEMPLATE={
        "s0": 5, "s1": "", "x0": "1", "x1": SDK_VERSION, "x2": PLATFORM,
        "x3": APP_ID, "x4": "4.86.0", "x5": b1,  # b1 fingerprint!
        "x6": "", "x7": "", "x8": "", "x9": -596800761, "x10": 0, "x11": "normal",
    },
)
xhshow = Xhshow(config)
session_mgr = SessionManager(config)

# --- Setup x-rap-param generator ---
js_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "xhs_rap.js")
with open(js_path, "r") as f:
    rap_ctx = execjs.compile(f.read())

# --- Target: GET /user_posted ---
path = "/api/sns/web/v1/user_posted"
params = {"num": "5", "cursor": "", "user_id": "5f84695f0000000001008c8d", "image_scenes": "FD_WM_WEBP"}

# Build full URI
full_uri = xhshow.build_url(path, params)
url = f"{XHS_API}{full_uri}"

# Generate X-s + X-t + X-S-Common
sign_headers = xhshow.sign_headers_get(uri=path, cookies=sign_cookies, params=params, session=session_mgr)

# Generate x-rap-param
x_rap = rap_ctx.call("generate_x_rap_param", full_uri, "")

# Build request
headers = {
    "user-agent": USER_AGENT,
    "cookie": cookie,
    "origin": "https://www.xiaohongshu.com",
    "referer": "https://www.xiaohongshu.com/",
    "accept": "application/json, text/plain, */*",
    "sec-ch-ua": f'"Not:A-Brand";v="99", "Google Chrome";v="{CHROME_VERSION}", "Chromium";v="{CHROME_VERSION}"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "dnt": "1",
    "priority": "u=1, i",
    "x-rap-param": x_rap,
}
headers.update(sign_headers)

print(f"\nRequest: GET {url[:80]}...")
print(f"  X-s: {headers.get('x-s', '')[:30]}...")
print(f"  X-S-Common length: {len(headers.get('x-s-common', ''))}")
print(f"  x-rap-param: {x_rap[:30]}...")

# Send!
resp = requests.get(url, headers=headers, timeout=15)
data = resp.json()
print(f"\nResponse: status={resp.status_code} code={data.get('code')} success={data.get('success')}")
notes = data.get("data", {}).get("notes", [])
print(f"  Notes: {len(notes)}")
if notes:
    print(f"  First: {notes[0].get('display_title', '?')}")
elif data.get("msg"):
    print(f"  Msg: {data.get('msg')}")
