---
name: xiaohongshu
description: 'Interact with Xiaohongshu (小红书) — search notes, read note details and comments, view user profiles, browse trending feed, like, favorite, and comment. Use this skill whenever the user mentions Xiaohongshu, 小红书, RED, xhs, wants to search XHS posts, read note content, browse trending notes, or interact with XHS content. Also trigger when the user pastes a xiaohongshu.com URL or mentions a note ID.'
---

# Xiaohongshu (小红书)

## Skill Directory

`<SKILL_DIR>` is the directory containing this SKILL.md file. Determine it ONCE at the start and reuse it.

## Setup (run FIRST — every time, before any operation)

```bash
sig status xiaohongshu 2>&1
```

Check the JSON output fields `configured` and `valid`:

- **`configured: false`** → run Provider Setup below.
- **`valid: false` (but configured: true)** → run `sig login xiaohongshu --mode visible`, then re-check.
- **`valid: true`** → execute the user's request.

### Provider Setup

1. Read `<SKILL_DIR>/references/provider-config.yaml`
2. Append the provider block to `~/.sig/config.yaml` under `providers:`
3. Run `sig login xiaohongshu --mode visible`
4. Verify: run `sig status xiaohongshu` again — must show `valid: true`

**Important:** Xiaohongshu requires manual browser login (visible mode). The browser will open — user must log in manually.

## Running Scripts

**Pattern:**

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR> && python3 scripts/<script>.py [args]'
```

- Read operations use the cookie from env automatically (no `--cookie` arg needed).
- Write operations require `--cookie "$SIG_XIAOHONGSHU_COOKIE"` explicitly.

## Scripts Reference

### Read Operations

| Script            | Purpose                | Args                                                                                |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `xhs_search.py`   | Search notes           | `--query TEXT [--limit N] [--sort general\|time_descending\|popularity_descending]` |
| `xhs_note.py`     | Note detail + comments | `--id NOTE_ID [--comments-limit N]`                                                 |
| `xhs_user.py`     | User profile + notes   | `--user-id ID [--limit N]`                                                          |
| `xhs_trending.py` | Explore/trending feed  | `[--category CATEGORY] [--limit N]`                                                 |

### Write Operations

| Script           | Purpose             | Args                                       |
| ---------------- | ------------------- | ------------------------------------------ |
| `xhs_like.py`    | Like/unlike         | `--cookie COOKIE --note-id ID [--undo]`    |
| `xhs_collect.py` | Favorite/unfavorite | `--cookie COOKIE --note-id ID [--undo]`    |
| `xhs_comment.py` | Post comment        | `--cookie COOKIE --note-id ID --text TEXT` |

## Command Examples

### Search notes

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR> && python3 scripts/xhs_search.py --query "Claude Code" --limit 5'
```

### Get note detail

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR> && python3 scripts/xhs_note.py --id 6656a1230000000012345678'
```

### View user profile

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR> && python3 scripts/xhs_user.py --user-id 5a1234567890abcdef012345'
```

### Browse trending

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR> && python3 scripts/xhs_trending.py --limit 10'
```

### Like a note

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR> && python3 scripts/xhs_like.py --cookie "$SIG_XIAOHONGSHU_COOKIE" --note-id 6656a1230000000012345678'
```

### Post a comment (ALWAYS confirm with user first)

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR> && python3 scripts/xhs_comment.py --cookie "$SIG_XIAOHONGSHU_COOKIE" --note-id 6656a1230000000012345678 --text "Great post!"'
```

## Safety Rules

1. **ALWAYS show comment text to user and get explicit confirmation before posting.**
2. **Like and collect are reversible** — use `--undo` to reverse.
3. **Comments are public** — confirm before posting.

## Error Handling

| Error             | Meaning              | Action                                                     |
| ----------------- | -------------------- | ---------------------------------------------------------- |
| `XHS_461`         | Signature rejected   | Signing algorithm may need update. Check upstream.         |
| `XHS_-101`        | No login info        | Run `sig login xiaohongshu --mode visible`, retry.         |
| `XHS_-104`        | No access permission | Session expired. Re-login.                                 |
| `XHS_300011`      | Account flagged      | Account marked as abnormal. Wait or use different account. |
| `AUTH_REQUIRED`   | Missing cookie       | Run `sig login xiaohongshu --mode visible`, retry.         |
| `ConnectionError` | Can't reach XHS      | Check network.                                             |

## Technical Notes

- **Signing:** XHS requires `x-s`, `x-t`, `x-s-common` headers on all API calls. Generated locally using MD5 + custom base64 (no JS execution needed).
- **Cookie `a1`:** Used as signing salt. Extracted separately by sigcli.
- **Cookie `web_session`:** Auth session token. Must be present for valid requests.
- **API base:** `https://edith.xiaohongshu.com`
- **Anti-bot:** If signing algorithm changes (461 errors), the `xhs_client.py` sign function needs updating. Check `ReaJason/xhs` repo for fixes.
