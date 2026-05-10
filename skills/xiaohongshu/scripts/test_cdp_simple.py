#!/usr/bin/env python3
"""Simplest possible CDP test: connect browser, navigate, XHR one request."""
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
print(f"Browser pid={state['pid']} port={state['port']}")

cdp = CdpClient(state["ws_url"], timeout=60)

# Simple XHR helper - clean, no escaping issues
def do_xhr(method, url, body=None):
    if body is not None:
        body_str = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
        # Encode body as base64 to avoid any escaping issues
        import base64
        b64 = base64.b64encode(body_str.encode()).decode()
        js = (
            "new Promise(function(resolve, reject) {"
            "  var xhr = new XMLHttpRequest();"
            f"  xhr.open('{method}', '{url}');"
            "  xhr.withCredentials = true;"
            "  xhr.setRequestHeader('content-type', 'application/json;charset=UTF-8');"
            "  xhr.onload = function() { resolve(xhr.responseText); };"
            "  xhr.onerror = function() { reject('error:' + xhr.status); };"
            f"  xhr.send(atob('{b64}'));"
            "})"
        )
    else:
        js = (
            "new Promise(function(resolve, reject) {"
            "  var xhr = new XMLHttpRequest();"
            f"  xhr.open('{method}', '{url}');"
            "  xhr.withCredentials = true;"
            "  xhr.onload = function() { resolve(xhr.responseText); };"
            "  xhr.onerror = function() { reject('error:' + xhr.status); };"
            "  xhr.send();"
            "})"
        )
    r = cdp.send("Runtime.evaluate", {"expression": js, "awaitPromise": True, "returnByValue": True})
    val = r.get("result", {}).get("value")
    if val:
        return json.loads(val)
    # Check exception
    exc = r.get("exceptionDetails", {}).get("exception", {}).get("description", "unknown")
    return {"error": exc}


# Test 1: user/me (baseline - no params, no signing needed)
print("\n1. GET /user/me (baseline)")
d = do_xhr("GET", "https://edith.xiaohongshu.com/api/sns/web/v2/user/me")
print(f"   code={d.get('code')} data_keys={list(d.get('data', {}).keys())[:5]}")

# Test 2: homefeed POST
print("\n2. POST /homefeed")
d = do_xhr("POST", "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed", {
    "num": 3, "refresh_type": 1, "note_index": 0, "cursor_score": "",
    "unread_begin_note_id": "", "unread_end_note_id": "",
    "unread_note_count": 0, "category": "homefeed_recommend"
})
print(f"   code={d.get('code')} items={len(d.get('data', {}).get('items', []))}")

# Test 3: search POST
print("\n3. POST /search/notes")
d = do_xhr("POST", "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes", {
    "keyword": "Python", "page": 1, "page_size": 20, "search_id": "cdpfinal1",
    "sort": "general", "note_type": 0, "ext_flags": [],
    "filters": [], "geo": "", "image_formats": ["jpg", "webp", "avif"]
})
items = d.get("data", {}).get("items", [])
print(f"   code={d.get('code')} items={len(items)}")
note_id = items[0]["id"] if items else ""
xsec = items[0].get("xsec_token", "") if items else ""
author = items[0].get("note_card", {}).get("user", {}).get("user_id", "") if items else ""

# Test 4: user_posted GET (the critical one that was 406 before)
print("\n4. GET /user_posted")
if author:
    d = do_xhr("GET", f"https://edith.xiaohongshu.com/api/sns/web/v1/user_posted?num=5&cursor=&user_id={author}&image_scenes=FD_WM_WEBP")
    print(f"   code={d.get('code')} notes={len(d.get('data', {}).get('notes', []))}")
else:
    print("   SKIP (no author from search)")

# Test 5: comments GET
print("\n5. GET /comment/page")
if note_id:
    d = do_xhr("GET", f"https://edith.xiaohongshu.com/api/sns/web/v2/comment/page?note_id={note_id}&cursor=&top_comment_id=&image_formats=jpg,webp,avif&xsec_token={xsec}")
    print(f"   code={d.get('code')} comments={len(d.get('data', {}).get('comments', []))}")
else:
    print("   SKIP (no note_id from search)")

cdp.close()
print("\nDone.")
