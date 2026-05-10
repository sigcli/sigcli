#!/usr/bin/env python3
"""Quick CDP POC: test user/me, homefeed, and user_posted (GET with params)."""
import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser, CdpClient

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)
cdp = CdpClient(state["ws_url"], timeout=60)


def xhr(method, url, body=None):
    """Execute XHR in page context and return parsed JSON."""
    if body:
        body_js = json.dumps(body) if isinstance(body, str) else f"JSON.stringify({json.dumps(body)})"
        js = (
            f'new Promise(function(r,j){{var x=new XMLHttpRequest();'
            f'x.open("{method}","{url}");x.withCredentials=true;'
            f'x.setRequestHeader("content-type","application/json;charset=UTF-8");'
            f'x.onload=function(){{r(x.responseText)}};'
            f'x.onerror=function(){{j("err:"+x.status)}};'
            f'x.send({body_js})}})'
        )
    else:
        js = (
            f'new Promise(function(r,j){{var x=new XMLHttpRequest();'
            f'x.open("{method}","{url}");x.withCredentials=true;'
            f'x.onload=function(){{r(x.responseText)}};'
            f'x.onerror=function(){{j("err:"+x.status)}};'
            f'x.send()}})'
        )
    result = cdp.send("Runtime.evaluate", {"expression": js, "awaitPromise": True, "returnByValue": True})
    value = result.get("result", {}).get("value", "")
    if not value:
        return {"error": str(result.get("exceptionDetails", {}))}
    return json.loads(value)


# Test 1: user/me (GET, no params - baseline)
print("1. GET /user/me")
d = xhr("GET", "https://edith.xiaohongshu.com/api/sns/web/v2/user/me")
print(f"   code={d.get('code')} nick={d.get('data',{}).get('nickname','?')}")

# Test 2: homefeed (POST)
print("2. POST /homefeed")
d = xhr("POST", "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed",
        {"num": 3, "refresh_type": 1, "note_index": 0, "cursor_score": "",
         "unread_begin_note_id": "", "unread_end_note_id": "",
         "unread_note_count": 0, "category": "homefeed_recommend"})
print(f"   code={d.get('code')} items={len(d.get('data',{}).get('items',[]))}")

# Test 3: user_posted GET (previously 406!)
print("3. GET /user_posted")
d = xhr("GET", "https://edith.xiaohongshu.com/api/sns/web/v1/user_posted?num=5&cursor=&user_id=5f84695f0000000001008c8d&image_scenes=FD_WM_WEBP")
print(f"   code={d.get('code')} notes={len(d.get('data',{}).get('notes',[]))}")

# Test 4: search (POST)
print("4. POST /search/notes")
d = xhr("POST", "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes",
        {"keyword": "AI", "page": 1, "page_size": 20, "search_id": "cdpv1",
         "sort": "general", "note_type": 0, "ext_flags": [],
         "filters": [], "geo": "", "image_formats": ["jpg", "webp", "avif"]})
items = d.get("data", {}).get("items", [])
print(f"   code={d.get('code')} items={len(items)}")
if items:
    note_id = items[0].get("id", "")
    xsec_token = items[0].get("xsec_token", "")

    # Test 5: comments GET
    print("5. GET /comment/page")
    d = xhr("GET", f"https://edith.xiaohongshu.com/api/sns/web/v2/comment/page?note_id={note_id}&cursor=&top_comment_id=&image_formats=jpg,webp,avif&xsec_token={xsec_token}")
    print(f"   code={d.get('code')} comments={len(d.get('data',{}).get('comments',[]))}")

cdp.close()
print("\nDone.")
