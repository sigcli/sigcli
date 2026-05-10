#!/usr/bin/env python3
"""POC: Test all 5 XHS APIs via CDP browser."""
import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser, call_api

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: SIG_XIAOHONGSHU_COOKIE not set")
    sys.exit(1)

state = ensure_browser(cookie)
print(f"Browser ready (pid={state['pid']}, port={state['port']})")

results = {}

# Test 1: Search (POST)
print("\n=== 1. Search (POST) ===")
data = call_api(state, "POST", "/api/sns/web/v1/search/notes", {
    "keyword": "AI", "page": 1, "page_size": 20, "search_id": "cdptest5",
    "sort": "general", "note_type": 0, "ext_flags": [],
    "filters": [], "geo": "", "image_formats": ["jpg", "webp", "avif"],
})
items = data.get("data", {}).get("items", [])
print(f"  code={data.get('code')}, items={len(items)}")
if items:
    note_id = items[0].get("id", "")
    xsec_token = items[0].get("xsec_token", "")
    author_id = items[0].get("note_card", {}).get("user", {}).get("user_id", "")
    print(f"  note_id={note_id}, author_id={author_id}")
    results["search"] = "OK"
else:
    print(f"  Full response: {json.dumps(data, ensure_ascii=False)[:200]}")
    results["search"] = f"FAIL code={data.get('code')}"
    # Can't continue without search results
    note_id = xsec_token = author_id = ""

# Test 2: Note detail (POST)
print("\n=== 2. Note Detail (POST) ===")
if note_id:
    data2 = call_api(state, "POST", "/api/sns/web/v1/feed", {
        "source_note_id": note_id,
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"},
        "xsec_source": "pc_search",
        "xsec_token": xsec_token,
    })
    note_items = data2.get("data", {}).get("items", [])
    if note_items:
        nc = note_items[0].get("note_card", {})
        print(f"  Title: {nc.get('title', '?')}")
        results["note_detail"] = "OK"
    else:
        print(f"  FAIL: {json.dumps(data2, ensure_ascii=False)[:200]}")
        results["note_detail"] = f"FAIL code={data2.get('code')}"
else:
    print("  SKIP (no note_id)")
    results["note_detail"] = "SKIP"

# Test 3: Comments (GET) — the critical test
print("\n=== 3. Comments (GET) ===")
if note_id:
    data3 = call_api(state, "GET", "/api/sns/web/v2/comment/page", {
        "note_id": note_id, "cursor": "", "top_comment_id": "",
        "image_formats": "jpg,webp,avif", "xsec_token": xsec_token,
    })
    comments = data3.get("data", {}).get("comments", [])
    print(f"  code={data3.get('code')}, comments={len(comments)}")
    if comments:
        print(f"  First: {comments[0].get('content', '')[:60]}")
        results["comments"] = "OK"
    elif data3.get("code") == 0:
        results["comments"] = "OK (empty)"
    else:
        print(f"  FAIL: {json.dumps(data3, ensure_ascii=False)[:200]}")
        results["comments"] = f"FAIL code={data3.get('code')}"
else:
    print("  SKIP")
    results["comments"] = "SKIP"

# Test 4: User info (GET)
print("\n=== 4. User Info (GET) ===")
if author_id:
    data4 = call_api(state, "GET", "/api/sns/web/v1/user/otherinfo", {
        "target_user_id": author_id,
    })
    basic = data4.get("data", {}).get("basic_info", {})
    if basic:
        print(f"  Nickname: {basic.get('nickname', '?')}")
        results["user_info"] = "OK"
    else:
        print(f"  FAIL: {json.dumps(data4, ensure_ascii=False)[:200]}")
        results["user_info"] = f"FAIL code={data4.get('code')}"
else:
    print("  SKIP")
    results["user_info"] = "SKIP"

# Test 5: User notes (GET)
print("\n=== 5. User Notes (GET) ===")
if author_id:
    data5 = call_api(state, "GET", "/api/sns/web/v1/user_posted", {
        "user_id": author_id, "num": 5, "cursor": "",
        "image_scenes": "FD_WM_WEBP",
    })
    notes = data5.get("data", {}).get("notes", [])
    print(f"  code={data5.get('code')}, notes={len(notes)}")
    if notes:
        print(f"  First: {notes[0].get('display_title', '?')}")
        results["user_notes"] = "OK"
    elif data5.get("code") == 0:
        results["user_notes"] = "OK (empty)"
    else:
        print(f"  FAIL: {json.dumps(data5, ensure_ascii=False)[:200]}")
        results["user_notes"] = f"FAIL code={data5.get('code')}"
else:
    print("  SKIP")
    results["user_notes"] = "SKIP"

# Summary
print("\n" + "=" * 40)
print("RESULTS:")
for k, v in results.items():
    status = "✅" if v.startswith("OK") else "❌"
    print(f"  {status} {k}: {v}")
all_ok = all(v.startswith("OK") for v in results.values())
print(f"\n{'ALL PASS' if all_ok else 'SOME FAILED'}")
