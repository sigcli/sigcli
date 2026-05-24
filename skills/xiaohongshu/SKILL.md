---
name: xiaohongshu
description: 'Interact with Xiaohongshu (小红书, RED, Little Red Book) — search notes, read note details, view comments, browse user profiles and posts, get home feed. Use this skill whenever the user mentions Xiaohongshu, 小红书, RED, RedNote, Little Red Book, wants to search for lifestyle/beauty/travel content, read XHS discussions, look up XHS users, or browse trending notes. Also trigger when the user pastes a xiaohongshu.com URL (e.g. xiaohongshu.com/explore/noteid) or mentions an XHS note ID.'
---

# Xiaohongshu

Search notes, read note details, view comments, browse user profiles, and get the home feed from Xiaohongshu (小红书).

## Skill Directory

`<SKILL_DIR>` is the directory containing this SKILL.md file. Determine it ONCE at the start and reuse it.

## Setup (run FIRST — every time, before any operation)

You MUST complete this setup before running any script. Do NOT skip.

```bash
sig status xiaohongshu 2>&1
```

Check the JSON output fields `configured` and `valid`:

- **`configured: false`** → run Provider Setup below.
- **`valid: false` (but configured: true)** → run `sig login xiaohongshu --mode visible`, **complete the captcha**, then re-check.
- **`valid: true`** → run Vendor Setup (one-time per machine), then execute the user's request.

### Provider Setup

1. Read `<SKILL_DIR>/references/provider-config.yaml`
2. Append the provider block to `~/.sig/config.yaml` under `providers:`
3. Run `sig login xiaohongshu --mode visible` — a browser opens; scan the QR code with the Xiaohongshu app **and complete the slider/image captcha if prompted**
4. Verify: `sig status xiaohongshu` should show `valid: true`

### Why the validateRule is so picky — three response shapes

`/api/sns/web/unread_count` is a permissive endpoint that hides a "partially expired cookie" state behind what looks like a successful response. The provider's `validateRule` is built specifically to reject it:

| State                             | `/api/sns/web/unread_count` returns                           | Detected as                                   |
| --------------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| Healthy cookie                    | `{code:0, success:true, data:{unread_count:N, likes:N, ...}}` | ✅ valid                                      |
| **Cookie partially expired**      | `{code:0, success:true, data:{}}`                             | ❌ rejected by `Object.keys(data).length > 0` |
| Cookie fully expired / logged out | `{code:-101, success:false, msg:"无登录信息"}`                | ❌ rejected by `code === 0`                   |

If `sig login` exits without prompting you, but later API calls fail with empty data — the partially-expired-cookie state was bypassed by a stale rule. Re-pull `references/provider-config.yaml` and refresh the rule in `~/.sig/config.yaml`, then re-login.

> **What this rule does NOT catch.** `unread_count` is more permissive than search/feed APIs. A cookie that passes the rule (state #1) may still fail on search if the risk-control / session-token portion has aged out. If `sig status` shows `valid:true` but search keeps returning empty data, you're in this gray zone — the only fix is `sig logout xiaohongshu && sig login xiaohongshu --mode visible`. See **Diagnosis** below for how to confirm.

### Vendor Setup (one-time per machine)

Unlike most skills, xiaohongshu signs every request via JS files at `<SKILL_DIR>/vendor/static/`, evaluated through PyExecJS. The skill ships those source files but not their npm/pip deps — install them once:

```bash
node --version                          # must be >= 18; install from https://nodejs.org if missing
cd <SKILL_DIR>/vendor && npm install    # installs crypto-js, jsdom
pip install --user -r <SKILL_DIR>/requirements.txt   # PyExecJS, requests, loguru, retry
```

If `pip` complains about externally-managed Python (PEP 668 on macOS/Debian), use a venv or `pipx`.

Smoke-test signing (no network, no cookie needed):

```bash
cd <SKILL_DIR>/vendor && python3 -c "
import sys; sys.path.insert(0, '.')
from xhs_utils.xhs_util import generate_x_rap_param, generate_xs_xs_common
xs, xt, xsc = generate_xs_xs_common('a1=test', '/api/sns/web/v1/feed', '', 'POST')
rap = generate_x_rap_param('/api/sns/web/v1/user_posted', '')
print('OK' if xs and rap else 'FAIL')
"
```

Expect `OK`. If it fails, see Error Handling.

## Running Scripts

All scripts output JSON to stdout. Read operations need a cookie (the public site does not allow anonymous access to most endpoints).

**Recommended — `sig run` injects the cookie as `SIG_XIAOHONGSHU_COOKIE`:**

```bash
sig run xiaohongshu -- bash -c 'python3 <SKILL_DIR>/scripts/xiaohongshu_search_note.py --keyword "AI" --page 1'
```

**Alternative — pass `--cookie` explicitly:**

```bash
COOKIE=$(sig get xiaohongshu --no-redaction --format value)
python3 <SKILL_DIR>/scripts/xiaohongshu_search_note.py --keyword "AI" --cookie "$COOKIE"
```

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Output is JSON to stdout.

| Script                             | Purpose                              | Auth   |
| ---------------------------------- | ------------------------------------ | ------ |
| `xiaohongshu_search_note.py`       | Search notes by keyword              | Cookie |
| `xiaohongshu_get_note_info.py`     | Get full note detail by URL          | Cookie |
| `xiaohongshu_get_note_comments.py` | Get top-level comments on a note     | Cookie |
| `xiaohongshu_get_user_info.py`     | Get a user's profile                 | Cookie |
| `xiaohongshu_get_user_notes.py`    | Get notes published by a user (page) | Cookie |
| `xiaohongshu_get_homefeed.py`      | Get home feed recommendations (page) | Cookie |

## Script Arguments

### `xiaohongshu_search_note.py`

- `--keyword` (required) — search keyword
- `--page` — page number, default `1`
- `--sort` — `0` general (default), `1` newest, `2` most-liked, `3` most-commented, `4` most-collected
- `--note-type` — `0` any (default), `1` video, `2` image
- `--cookie` — override env var

### `xiaohongshu_get_note_info.py`

- `--url` (required) — full note URL like `https://www.xiaohongshu.com/explore/<id>?xsec_token=...&xsec_source=pc_search`
- `--cookie`

### `xiaohongshu_get_note_comments.py`

- `--note-id` (required)
- `--xsec-token` (required) — comes from a search/feed result
- `--cursor` — pagination, default empty
- `--cookie`

### `xiaohongshu_get_user_info.py`

- `--user-id` (required)
- `--cookie`

### `xiaohongshu_get_user_notes.py`

- `--user-id` (required)
- `--cursor` — pagination, default empty
- `--xsec-token`, `--xsec-source` — pass through if available
- `--cookie`

### `xiaohongshu_get_homefeed.py`

- `--category` — channel id, default `homefeed_recommend`
- `--cursor-score` — pagination
- `--refresh-type`, `--note-index` — feed iteration state
- `--cookie`

## Key Concepts

- **xsec_token / xsec_source**: per-note security tokens issued by the search/feed endpoints. To call `get_note_info` or `get_note_comments`, you must first call `search_note` to obtain these tokens (they are embedded in the note URL returned).
- **Why Node.js?** XHS signs every request with `x-s`, `x-t`, `x-s-common`, `x-rap-param`, and `x-xray-traceid` derived from JSVMP-obfuscated JavaScript. The skill ships those JS files (`<SKILL_DIR>/vendor/static/`) and runs them via PyExecJS, which shells out to `node`. Pure-Python signing libraries (e.g. xhshow) currently miss `x-rap-param` and fail on data APIs with HTTP 406.

## Error Handling

| Error                          | Meaning                                                                                                                                                                                                                                                                                                                | Fix                                                                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_REQUIRED`                | No cookie available                                                                                                                                                                                                                                                                                                    | `sig login xiaohongshu --mode visible`                                                                                                                                                                                           |
| `VENDOR_MISSING`               | `<SKILL_DIR>/vendor/` not populated                                                                                                                                                                                                                                                                                    | Run `<SKILL_DIR>/scripts/sync-vendor.sh`                                                                                                                                                                                         |
| `NODE_MODULES_MISSING`         | `vendor/node_modules/` missing                                                                                                                                                                                                                                                                                         | `cd <SKILL_DIR>/vendor && npm install`                                                                                                                                                                                           |
| `API_ERROR` with `msg="'msg'"` | Vendor parser hit `KeyError: 'msg'` because the API returned `{code:0, success:true, data:{}}`. **The cookie has expired enough to fail on search even though `unread_count` may still pass.** This is the most common failure mode in normal use — sessions age out faster than `unread_count`'s acceptance criteria. | `sig logout xiaohongshu && sig login xiaohongshu --mode visible`. If `sig login` exits immediately without prompting (because the old `unread_count`-passing cookie is still present), check `Diagnosis` below first to confirm. |
| `API_ERROR` with `code=-101`   | `无登录信息` — session is gone                                                                                                                                                                                                                                                                                         | `sig login xiaohongshu --mode visible`                                                                                                                                                                                           |
| `API_ERROR` (other)            | Account flagged, vendor schema drift, etc.                                                                                                                                                                                                                                                                             | `sig logout xiaohongshu && sig login xiaohongshu --mode visible`. If it persists after re-login, run `<SKILL_DIR>/scripts/sync-vendor.sh` to refresh the signing JS.                                                             |
| `HTTP_<code>`                  | Network / transport failure                                                                                                                                                                                                                                                                                            | Check connectivity                                                                                                                                                                                                               |

## Workflow Examples

### Find a topic and read the top result with comments

```bash
# 1. Search — output is JSON with a list of notes
sig run xiaohongshu -- bash -c \
  'python3 <SKILL_DIR>/scripts/xiaohongshu_search_note.py --keyword "城市探索" --sort 2' \
  > /tmp/xhs_search.json

# 2. Extract note_id + xsec_token from the first result.
#    Path: items[0].id  and  items[0].xsec_token
NOTE_ID=$(jq -r '.items[0].id' /tmp/xhs_search.json)
XSEC=$(jq -r '.items[0].xsec_token' /tmp/xhs_search.json)
URL="https://www.xiaohongshu.com/explore/${NOTE_ID}?xsec_token=${XSEC}&xsec_source=pc_search"

# 3. Get full detail
sig run xiaohongshu -- bash -c \
  "python3 <SKILL_DIR>/scripts/xiaohongshu_get_note_info.py --url '$URL'"

# 4. Get comments
sig run xiaohongshu -- bash -c \
  "python3 <SKILL_DIR>/scripts/xiaohongshu_get_note_comments.py --note-id '$NOTE_ID' --xsec-token '$XSEC'"
```

## Diagnosis: when search fails, do NOT jump to conclusions

`sig status xiaohongshu` showing `valid: true` is **necessary but not sufficient** for search to work. The validateUrl is permissive on purpose (so it can run without XHS request signing), which means a cookie that has aged out enough to fail on search may still pass validation. Before re-logging in or "fixing" anything, triangulate with three probes:

```bash
# Probe 1 — what sig itself thinks
sig status xiaohongshu

# Probe 2 — what the validateUrl says (permissive endpoint)
sig run xiaohongshu -- bash -c \
  'curl -sL -H "Cookie: $SIG_XIAOHONGSHU_COOKIE" -H "User-Agent: Mozilla/5.0" \
   https://edith.xiaohongshu.com/api/sns/web/unread_count'

# Probe 3 — what a stricter authenticated endpoint says
sig run xiaohongshu -- bash -c \
  'curl -sL -H "Cookie: $SIG_XIAOHONGSHU_COOKIE" -H "User-Agent: Mozilla/5.0" \
   https://edith.xiaohongshu.com/api/sns/web/v2/user/me'
```

Read the three answers together:

| sig status  | unread_count            | v2/user/me                 | Most likely cause                                                                                                                                       | Fix                                                                                                 |
| ----------- | ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| valid:true  | code:0 + non-empty data | code:0 + your real user_id | Cookie is healthy. **Search itself is failing for another reason** — vendor schema drift, transient network, account-level flag. Do NOT re-login first. | Re-run `sync-vendor.sh`, retry once, only re-login if that doesn't help                             |
| valid:true  | code:0 + non-empty data | code:0 + `guest:false`     | Cookie passes the rule but search still fails                                                                                                           | Cookie has aged into the gray zone. `sig logout && sig login --mode visible`                        |
| valid:true  | code:0 + `data:{}`      | code:-1 / 401              | Local config has the old loose validateRule — sigcli accepted a half-cooked cookie                                                                      | Refresh `~/.sig/config.yaml` from `references/provider-config.yaml`, then `sig logout && sig login` |
| valid:false | —                       | —                          | Cookie fully expired or never written                                                                                                                   | `sig login xiaohongshu --mode visible`                                                              |

The mistake the previous version of this skill encouraged: see `KeyError: 'msg'` → assume captcha → tell the user to re-login + solve captcha. Most of the time captcha never appears, the real cause is cookie aging, and re-login _does_ fix it — but for the wrong reason. Document the right reason so the next debugger doesn't get misled.

Two-tier verification. Run tier 1 unconditionally; tier 2 only after tier 1 passes.

### Tier 1: prerequisite checks (read-only, safe)

```bash
# 1. Provider authenticated and validated against the strict rule
sig status xiaohongshu
# Expect: configured: true, valid: true
```

```bash
# 2. Probe the validateUrl directly — must return non-empty data object
sig run xiaohongshu -- bash -c 'curl -sL --max-time 10 \
  -H "Cookie: $SIG_XIAOHONGSHU_COOKIE" \
  -H "User-Agent: Mozilla/5.0" \
  https://edith.xiaohongshu.com/api/sns/web/unread_count'
# Expect: {"code":0,"success":true,"msg":"成功","data":{"unread_count":N,...}}
# If `data` is `{}` → captcha not solved. Re-login with --mode visible and complete the captcha.
# If code is -101 → session gone. Re-login.
```

```bash
# 3. Vendor signing JS deps installed
test -d <SKILL_DIR>/vendor/node_modules && echo "OK: node_modules present" || echo "FAIL: cd vendor && npm install"
```

```bash
# 4. Smoke-test signature generation (no network, no cookie)
cd <SKILL_DIR>/vendor && python3 -c "
import sys; sys.path.insert(0, '.')
from xhs_utils.xhs_util import generate_x_rap_param, generate_xs_xs_common
xs, xt, xsc = generate_xs_xs_common('a1=test', '/api/sns/web/v1/feed', '', 'POST')
rap = generate_x_rap_param('/api/sns/web/v1/user_posted', '')
print('OK' if xs and rap else 'FAIL')
"
# Expect: OK
```

### Tier 2: live execution test

Run a tiny search and assert that `items` is a non-empty list. This is the canary for "everything actually works":

```bash
sig run xiaohongshu -- bash -c \
  'python3 <SKILL_DIR>/scripts/xiaohongshu_search_note.py --keyword "AI"' \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items', [])
assert isinstance(items, list) and len(items) > 0, f'expected items list, got: {d}'
print(f'OK: {len(items)} items')
"
# Expect: OK: N items
# If you see {'error': 'API_ERROR', 'message': \"code=0, msg=\\\"'msg'\\\"\"} → captcha-not-solved
# soft-reject. The cookie is half-cooked even though sig status shows valid:true.
# Refresh references/provider-config.yaml into ~/.sig/config.yaml, then re-login with captcha.
```

This skill bundles a minimal slice of [cv-cat/Spider_XHS](https://github.com/cv-cat/Spider_XHS) (MIT) at `<SKILL_DIR>/vendor/`. To bump the vendored version:

```bash
<SKILL_DIR>/scripts/sync-vendor.sh           # latest master
<SKILL_DIR>/scripts/sync-vendor.sh <ref>     # specific commit/tag
```

License and upstream metadata are in `<SKILL_DIR>/vendor/LICENSE` and `<SKILL_DIR>/vendor/UPSTREAM.md`.
