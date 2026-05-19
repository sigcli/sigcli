---
name: xiaohongshu
description: 'Interact with Xiaohongshu (小红书, RED, Little Red Book) — search notes, read note details, view comments, browse user profiles and posts, get home feed. Use this skill whenever the user mentions Xiaohongshu, 小红书, RED, RedNote, Little Red Book, wants to search for lifestyle/beauty/travel content, read XHS discussions, look up XHS users, or browse trending notes. Also trigger when the user pastes a xiaohongshu.com URL (e.g. xiaohongshu.com/explore/noteid) or mentions an XHS note ID.'
---

# Xiaohongshu

Search notes, read note details, view comments, browse user profiles, and get the home feed from Xiaohongshu (小红书).

## Skill Directory

`<SKILL_DIR>` is the directory containing this SKILL.md file. After installation it is one of:

- Claude Code: `~/.claude/skills/xiaohongshu`
- Cursor: `~/.cursor/skills/xiaohongshu`
- Windsurf: `~/.windsurf/skills/xiaohongshu`
- Cline: `~/.cline/skills/xiaohongshu`

Resolve it once at the start of any session and reuse.

## First-Time Install (one-time per machine)

If `<SKILL_DIR>` does not exist yet, do these four steps in order. Re-running any step is safe (idempotent).

### 1. Install sigcli

```bash
npm install -g @sigcli/cli
sig init                              # creates ~/.sig/config.yaml
```

Verify: `command -v sig && sig --version` prints a version.

### 2. Install the xiaohongshu skill

From the [sigcli repo](https://github.com/pylonai/sigcli):

```bash
git clone https://github.com/pylonai/sigcli.git
cd sigcli/skills
./install.sh                          # auto-detects your agent (Claude/Cursor/...)
# or: ./install.sh --agent claude
```

This copies the skill (including `vendor/`) to `<SKILL_DIR>`, **excluding** `node_modules/` (you install that next, locally).

Verify: `test -f <SKILL_DIR>/SKILL.md && test -f <SKILL_DIR>/vendor/static/xhs_rap.js`.

### 3. Install runtime dependencies

XHS request signing requires Node.js 18+ to evaluate the bundled JS files via PyExecJS.

```bash
node --version                        # must be >= 18; install from https://nodejs.org if missing

cd <SKILL_DIR>/vendor && npm install  # installs crypto-js, jsdom into vendor/node_modules
pip install --user -r <SKILL_DIR>/requirements.txt
```

If `pip` complains about externally-managed Python (PEP 668 on macOS/Debian), use a venv or `pipx`.

Verify with the sign-only smoke test (no network, no cookie needed):

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

### 4. Configure the sigcli provider and login

```bash
# 4a. Append the provider block to ~/.sig/config.yaml under `providers:`
cat <SKILL_DIR>/references/provider-config.yaml >> ~/.sig/config.yaml

# 4b. Browser login (a window opens; scan the QR code with the Xiaohongshu app)
sig login xiaohongshu
```

Verify with the pre-flight check below.

## Pre-flight Check (run before every session)

```bash
sig status xiaohongshu
```

Inspect the JSON `configured` and `valid` fields:

| State                            | Meaning                                                       | Action                       |
| -------------------------------- | ------------------------------------------------------------- | ---------------------------- |
| `configured: false`              | Skill is installed but provider isn't in `~/.sig/config.yaml` | Step 4a above                |
| `configured: true, valid: false` | Cookie expired or never logged in                             | `sig login xiaohongshu`      |
| `configured: true, valid: true`  | Ready                                                         | Proceed to "Running Scripts" |

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

| Error                  | Meaning                                  | Fix                                               |
| ---------------------- | ---------------------------------------- | ------------------------------------------------- |
| `AUTH_REQUIRED`        | No cookie available                      | `sig login xiaohongshu`                           |
| `VENDOR_MISSING`       | `<SKILL_DIR>/vendor/` not populated      | Run `<SKILL_DIR>/scripts/sync-vendor.sh`          |
| `NODE_MODULES_MISSING` | `vendor/node_modules/` missing           | `cd <SKILL_DIR>/vendor && npm install`            |
| `API_ERROR` + `461`    | CAPTCHA / risk control triggered         | Wait several minutes; reduce request frequency    |
| `API_ERROR` + `300011` | Account marked abnormal                  | Wait 24h; switch network; use a different account |
| `API_ERROR` + `406`    | Signing rejected (algorithm out of date) | `<SKILL_DIR>/scripts/sync-vendor.sh` to refresh   |
| `HTTP_<code>`          | Network / transport failure              | Check connectivity                                |

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

## Vendoring

This skill bundles a minimal slice of [cv-cat/Spider_XHS](https://github.com/cv-cat/Spider_XHS) (MIT) at `<SKILL_DIR>/vendor/`. To bump the vendored version:

```bash
<SKILL_DIR>/scripts/sync-vendor.sh           # latest master
<SKILL_DIR>/scripts/sync-vendor.sh <ref>     # specific commit/tag
```

License and upstream metadata are in `<SKILL_DIR>/vendor/LICENSE` and `<SKILL_DIR>/vendor/UPSTREAM.md`.
