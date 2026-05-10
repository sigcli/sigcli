---
name: xiaohongshu
description: 'Interact with Xiaohongshu (小红书, RED, Little Red Book) — search notes, read note details, view comments, browse user profiles and their posts, like/favorite/comment/follow. Use this skill whenever the user mentions Xiaohongshu, 小红书, RED, RedNote, Little Red Book, wants to search for lifestyle/beauty/travel content, read XHS discussions, look up XHS users, browse trending notes, or interact with content (like, favorite, comment, follow). Also trigger when the user pastes a xiaohongshu.com URL (e.g. xiaohongshu.com/explore/noteid) or mentions an XHS note ID.'
---

# Xiaohongshu (小红书)

Search notes, read note details, view comments, browse user profiles and their published posts, like/favorite notes, post comments, and follow/unfollow users on Xiaohongshu (RED / Little Red Book).

## Skill Directory

`<SKILL_DIR>` is the directory containing this SKILL.md file. Determine it ONCE at the start and reuse it.

## Setup (run FIRST — every time, before any operation)

You MUST complete this setup before running any script. Do NOT skip this step.

```bash
sig status xiaohongshu 2>&1
```

Check the JSON output fields `configured` and `valid`:

- **`configured: false`** → run Provider Setup below. Do NOT proceed without completing it.
- **`valid: false` (but configured: true)** → run `sig login xiaohongshu`, then re-check.
- **`valid: true`** → detect proxy (see below), then execute the user's request.

### Provider Setup

1. Read `<SKILL_DIR>/references/provider-config.yaml`
2. Append the provider block to `~/.sig/config.yaml` under `providers:`
3. Ask the user: "Do you need a proxy to access this site?" — if yes, add `networkProxy: <url>` under the provider in config.yaml
4. Run `sig login xiaohongshu` (with `--network-proxy <url>` if proxy was specified)
5. Verify: run `sig status xiaohongshu` again — must show `valid: true` before proceeding

### Proxy Detection (after provider is valid)

```bash
grep -A15 "^\s*xiaohongshu:" ~/.sig/config.yaml | grep networkProxy | awk '{print $2}'
```

If this outputs a URL, prefix ALL python3 commands with `HTTPS_PROXY=<url> HTTP_PROXY=<url>`.
If using socks5, convert to socks5h for python (e.g. `socks5://...` → `socks5h://...`).
If empty, no proxy needed.

## Running Scripts

All scripts require setup to be completed first (see above).

**Invocation pattern** — use `sig run` to inject credentials:

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_search.py --keyword "AI" --limit 5'
```

Environment variables injected by `sig run xiaohongshu`:

| Variable                      | Contents                               |
| ----------------------------- | -------------------------------------- |
| `SIG_XIAOHONGSHU_COOKIE`      | Full cookie string                     |
| `SIG_XIAOHONGSHU_A1`          | `a1` cookie value (device fingerprint) |
| `SIG_XIAOHONGSHU_WEB_SESSION` | `web_session` cookie value             |
| `SIG_XIAOHONGSHU_WEBID`       | `webId` cookie value                   |

Scripts read these automatically via `XhsClient.create()`. No need to pass `--cookie` explicitly.

**On auth error:** run `sig login xiaohongshu` automatically (no user prompt), then retry.

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script              | Purpose                    | Auth     |
| ------------------- | -------------------------- | -------- |
| `xhs_search.py`     | Search notes by keyword    | Required |
| `xhs_note.py`       | Get note detail            | Required |
| `xhs_comments.py`   | Get comments for a note    | Required |
| `xhs_user.py`       | Get user profile           | Required |
| `xhs_user_notes.py` | Get user's published notes | Required |
| `xhs_homefeed.py`   | Get recommended home feed  | Required |

### Write Operations

| Script            | Purpose                       | Auth     |
| ----------------- | ----------------------------- | -------- |
| `xhs_like.py`     | Like or unlike a note         | Required |
| `xhs_favorite.py` | Favorite or unfavorite a note | Required |
| `xhs_comment.py`  | Post a comment or reply       | Required |
| `xhs_follow.py`   | Follow or unfollow a user     | Required |

### xhs_search.py

```
--keyword TEXT        Search keyword (required)
--limit N            Max results (default: 20)
--page N             Page number (default: 1)
--sort TYPE          Sort order: general, popularity, time (default: general)
--note-type N        Note type: 0=all, 1=image, 2=video (default: 0)
--search-id ID       Search ID for pagination (from previous results)
```

### xhs_note.py

```
--note-id ID         Note ID (required)
--xsec-token TOKEN   Security token from search results (required)
--xsec-source SRC    Source identifier (default: pc_search)
```

### xhs_comments.py

```
--note-id ID         Note ID (required)
--xsec-token TOKEN   Security token from search results (required)
--cursor CURSOR      Pagination cursor from previous response
--limit N            Max comments (default: 20)
```

### xhs_user.py

```
--user-id ID         User ID (optional; omit for current user)
```

### xhs_user_notes.py

```
--user-id ID         User ID (required)
--cursor CURSOR      Pagination cursor from previous response
--limit N            Max notes (default: 30)
```

### xhs_homefeed.py

```
--category CAT       Feed category (default: homefeed_recommend)
--limit N            Max notes (default: 20)
```

### xhs_like.py

```
--note-id ID         Note ID (required)
--undo               Unlike instead of like
```

### xhs_favorite.py

```
--note-id ID         Note ID (required)
--undo               Unfavorite instead of favorite
```

### xhs_comment.py

```
--note-id ID         Note ID (required)
--content TEXT       Comment text (required)
--reply-to ID        Comment ID to reply to (optional)
```

### xhs_follow.py

```
--user-id ID         User ID (required)
--undo               Unfollow instead of follow
```

## Key Concepts

**xsec_token** — A security token returned with each note in search results. You MUST pass this token when fetching note detail or comments. Without it, the API rejects the request. Always save `xsec_token` from search results and pass it to `xhs_note.py` and `xhs_comments.py`.

**search_id** — A unique session identifier generated on the first search request. For pagination (fetching page 2, 3, etc.), pass the `search_id` from the first page's response to subsequent calls. This keeps results consistent.

**Note types** — Xiaohongshu has two main content types:

- `normal` (type=1 filter) — Image-based notes with text and photo galleries
- `video` (type=2 filter) — Video notes
- Use `0` (all) to search both types

**xsec_source** — Indicates where the note was accessed from. Use `pc_search` for notes found via search, `pc_user` for notes from a user's profile page.

## Error Handling

| Error              | Cause                           | Fix                                                      |
| ------------------ | ------------------------------- | -------------------------------------------------------- |
| `AUTH_REQUIRED`    | No cookie or a1 value           | Auto-run `sig login xiaohongshu` (no user prompt), retry |
| `SESSION_EXPIRED`  | Cookie expired (401/403)        | Auto-run `sig login xiaohongshu` (no user prompt), retry |
| `CAPTCHA_REQUIRED` | Anti-bot triggered (461/471)    | Wait 2-5 minutes, then retry. Do NOT retry immediately   |
| `SIGN_FAILED`      | Request signature invalid (406) | Run `pip install --upgrade xhshow`, then retry           |
| `RATE_LIMITED`     | Too many requests (429)         | Wait 30-60 seconds, then retry                           |
| `NOT_FOUND`        | Note or user does not exist     | Verify the ID with the user                              |
| `API_ERROR`        | Xiaohongshu returned error      | Check error message for details                          |

## Workflow Examples

### Search for notes

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_search.py --keyword "咖啡推荐" --limit 5'
```

### Search with filters

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_search.py --keyword "旅行攻略" --sort popularity --note-type 2 --limit 10'
```

### Paginate search results

1. First page (save `search_id` from response):
    ```bash
    sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_search.py --keyword "穿搭" --limit 10'
    ```
2. Next page:
    ```bash
    sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_search.py --keyword "穿搭" --limit 10 --page 2 --search-id "SEARCH_ID_FROM_PAGE_1"'
    ```

### Get note detail (from search results)

1. Search first to get `note_id` and `xsec_token`:
    ```bash
    sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_search.py --keyword "美食" --limit 5'
    ```
2. Fetch detail using `note_id` and `xsec_token` from results:
    ```bash
    sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_note.py --note-id "6789abcdef" --xsec-token "TOKEN_FROM_SEARCH"'
    ```

### Read comments on a note

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_comments.py --note-id "6789abcdef" --xsec-token "TOKEN_FROM_SEARCH" --limit 20'
```

### Browse home feed

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_homefeed.py --limit 10'
```

### View user profile

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_user.py --user-id "5a1234567890abcdef012345"'
```

### View own profile

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_user.py'
```

### Browse user's notes

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_user_notes.py --user-id "5a1234567890abcdef012345" --limit 10'
```

### Like a note

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_like.py --note-id "NOTE_ID"'
```

### Unlike a note

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_like.py --note-id "NOTE_ID" --undo'
```

### Favorite a note

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_favorite.py --note-id "NOTE_ID"'
```

### Post a comment

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_comment.py --note-id "NOTE_ID" --content "Great post!"'
```

### Reply to a comment

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_comment.py --note-id "NOTE_ID" --content "Thanks!" --reply-to "COMMENT_ID"'
```

### Follow a user

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_follow.py --user-id "USER_ID"'
```

### Unfollow a user

```bash
sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_follow.py --user-id "USER_ID" --undo'
```

### Full workflow: search → detail → comments → like

1. Search:
    ```bash
    sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_search.py --keyword "上海探店" --limit 5'
    ```
2. Pick a note from results, use its `note_id` and `xsec_token`:
    ```bash
    sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_note.py --note-id "NOTE_ID" --xsec-token "XSEC_TOKEN"'
    ```
3. Read comments on that note:
    ```bash
    sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_comments.py --note-id "NOTE_ID" --xsec-token "XSEC_TOKEN" --limit 20'
    ```
4. Like the note:
    ```bash
    sig run xiaohongshu -- bash -c 'cd <SKILL_DIR>/scripts && python3 xhs_like.py --note-id "NOTE_ID"'
    ```
