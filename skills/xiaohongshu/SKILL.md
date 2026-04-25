---
name: xiaohongshu
description: 'Interact with Xiaohongshu (小红书) — browse notes, search content, view user profiles, read comments, like/collect notes, and post comments. Use this skill whenever the user mentions Xiaohongshu, 小红书, XHS, RED, wants to browse Xiaohongshu notes, search posts, look up users, or interact with Xiaohongshu content. Also trigger when the user pastes a xiaohongshu.com URL or xhslink.com short link.'
---

# Xiaohongshu (小红书)

Browse notes, search content, view user profiles, read comments, and interact with Xiaohongshu.

## Authentication

**Read operations** (note detail, search, user profile, feed) use SSR HTML parsing and work with or without authentication. Some pages may require login cookies for full access.

**Write operations** (like, collect, comment) require a **session cookie**. Use `sig run` to inject it:

```bash
sig run xiaohongshu -- bash -c 'python3 scripts/xhs_like.py --cookie "$SIG_XIAOHONGSHU_COOKIE" --id 69aa7160000000001b01634d'
```

The default Signet provider is `xiaohongshu`. The env var is `SIG_XIAOHONGSHU_COOKIE`.

If a write script returns auth error, re-authenticate:

```bash
sig login https://www.xiaohongshu.com/explore
```

**Note:** Xiaohongshu has aggressive anti-bot protection. If `sig login` fails, copy cookies manually:

1. Open https://www.xiaohongshu.com/ in your browser and log in
2. Open DevTools (F12) → Application → Cookies → `www.xiaohongshu.com`
3. Copy all cookies as a string (especially `web_session`, `a1`)
4. Run: `sig login https://www.xiaohongshu.com/explore --as xiaohongshu --cookie "web_session=<value>; a1=<value>"`

**Signet provider config:**

```yaml
xiaohongshu:
    domains: ['www.xiaohongshu.com', 'xiaohongshu.com', 'edith.xiaohongshu.com']
    entryUrl: https://www.xiaohongshu.com/explore
    strategy: cookie
```

## Anti-Bot Limitations

Xiaohongshu has heavy anti-bot protection. This skill uses HTTP-only requests (no browser automation), which means:

- **Note detail** may require an `xsec_token` (available in search results or feed URLs). Without it, some notes may return errors.
- **API endpoints** (comments, write operations) may return HTTP 461 when anti-bot protection triggers.
- **Search and feed** rely on SSR HTML parsing, which is more reliable than direct API calls.
- If requests are blocked, wait a few minutes and retry, or re-authenticate with fresh cookies.

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script            | Purpose                | Auth     |
| ----------------- | ---------------------- | -------- |
| `xhs_note.py`     | Note detail            | Optional |
| `xhs_search.py`   | Search notes           | Optional |
| `xhs_user.py`     | User profile and notes | Optional |
| `xhs_feed.py`     | Explore/home feed      | Optional |
| `xhs_comments.py` | Note comments          | Optional |

### Write Operations

| Script           | Purpose            | Auth     |
| ---------------- | ------------------ | -------- |
| `xhs_like.py`    | Like/unlike a note | Required |
| `xhs_collect.py` | Collect/uncollect  | Required |
| `xhs_comment.py` | Post a comment     | Required |

### xhs_note.py

```
--id ID               Note ID, URL, or explore link (required)
--xsec-token TOKEN    xsec_token for signed access (recommended)
```

### xhs_search.py

```
--keyword TEXT        Search keyword (required)
--limit N            Max results (default: 20)
```

### xhs_user.py

```
--id ID              User ID or profile URL (required)
--no-notes           Skip fetching user notes (flag)
```

### xhs_feed.py

```
--limit N            Max notes to return (default: 20)
```

### xhs_comments.py

```
--id ID              Note ID or URL (required)
--limit N            Max top-level comments (default: 20)
```

### xhs_like.py

```
--cookie COOKIE      Xiaohongshu session cookie (required)
--id ID              Note ID or URL (required)
--undo               Unlike instead of like (flag)
```

### xhs_collect.py

```
--cookie COOKIE      Xiaohongshu session cookie (required)
--id ID              Note ID or URL (required)
--undo               Uncollect instead of collect (flag)
```

### xhs_comment.py

```
--cookie COOKIE      Xiaohongshu session cookie (required)
--id ID              Note ID or URL (required)
--text TEXT          Comment text (required)
```

## Safety

**Always show the user the comment text and get explicit confirmation before calling `xhs_comment.py`.** Comments are public.

**`xhs_like.py` and `xhs_collect.py` are reversible** — use `--undo` to unlike or uncollect.

## Key Concepts

**Note IDs** — 24-character hex strings (e.g., `69aa7160000000001b01634d`). Follow MongoDB ObjectID format where the first 8 hex characters encode a Unix timestamp.

**Note URLs** — Multiple formats accepted:

- `https://www.xiaohongshu.com/explore/{note_id}?xsec_token=...`
- `https://www.xiaohongshu.com/discovery/item/{note_id}`
- `https://www.xiaohongshu.com/note/{note_id}`
- Bare 24-char hex ID

**xsec_token** — A signed token required for some note URLs. It comes from search results and feed items. Pass it via `--xsec-token` for reliable note access. Without it, some notes may be blocked.

**SSR HTML parsing** — Read operations parse `window.__INITIAL_STATE__` JSON embedded in the page HTML. This is more reliable than direct API calls which may be blocked by anti-bot protection.

**User IDs** — Alphanumeric strings. Can be extracted from profile URLs: `https://www.xiaohongshu.com/user/profile/{user_id}`.

## Error Handling

| Error          | Cause                            | Fix                                         |
| -------------- | -------------------------------- | ------------------------------------------- |
| HTTP_461       | Anti-bot protection triggered    | Wait and retry with fresh cookies           |
| ANTI_BOT       | Request blocked by anti-bot      | Wait, retry, or re-authenticate             |
| LOGIN_REQUIRED | Page requires authentication     | Run `sig login` and retry                   |
| NOT_FOUND      | Note or page does not exist      | Check the note ID                           |
| SECURITY_BLOCK | Access blocked by security check | Try with xsec_token or re-authenticate      |
| PARSE_ERROR    | Cannot parse page HTML           | Page structure may have changed             |
| INVALID_ID     | Cannot parse note/user ID        | Check the ID format (24-char hex for notes) |
| AUTH_REQUIRED  | No cookie for write operation    | Run `sig login` and retry                   |
| EMPTY_COMMENT  | Comment text is empty            | Provide non-empty comment text              |
| API_ERROR      | API request failed               | Check error details, retry                  |

## Workflow Examples

### Browse explore feed

1. `python3 scripts/xhs_feed.py --limit 10`

### Search for notes

1. `python3 scripts/xhs_search.py --keyword "旅行攻略" --limit 10`

### Read a note

1. `python3 scripts/xhs_note.py --id 69aa7160000000001b01634d --xsec-token abc123`
2. Or from URL: `python3 scripts/xhs_note.py --id "https://www.xiaohongshu.com/explore/69aa7160000000001b01634d?xsec_token=abc123"`

### View note comments

1. `python3 scripts/xhs_comments.py --id 69aa7160000000001b01634d --limit 30`

### View a user profile

1. `python3 scripts/xhs_user.py --id user123abc`
2. Or from URL: `python3 scripts/xhs_user.py --id "https://www.xiaohongshu.com/user/profile/user123abc"`

### Like a note

1. `sig run xiaohongshu -- bash -c 'python3 scripts/xhs_like.py --cookie "$SIG_XIAOHONGSHU_COOKIE" --id 69aa7160000000001b01634d'`

### Collect a note

1. `sig run xiaohongshu -- bash -c 'python3 scripts/xhs_collect.py --cookie "$SIG_XIAOHONGSHU_COOKIE" --id 69aa7160000000001b01634d'`

### Post a comment

1. **Show comment text to user and get confirmation**
2. `sig run xiaohongshu -- bash -c 'python3 scripts/xhs_comment.py --cookie "$SIG_XIAOHONGSHU_COOKIE" --id 69aa7160000000001b01634d --text "写得真好！"'`
