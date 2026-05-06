---
name: x
description: 'Interact with X (Twitter) — view profiles, read tweets and threads, search posts, check trending topics, view followers, post tweets, like, retweet, follow users, and bookmark tweets. Use this skill whenever the user mentions X, Twitter, tweets, @handles, wants to browse X posts, search X, view user profiles, or interact with X content. Also trigger when the user pastes an x.com or twitter.com URL.'
---

# X (Twitter)

## Skill Directory

`<SKILL_DIR>` is the directory containing this SKILL.md file. To find it, look at the path where this skill was loaded from. It is typically `~/.claude/skills/x` (installed) or wherever this file lives. Determine it ONCE at the start and reuse it.

## Fast Gate (run this FIRST, every time)

Run these two commands silently — do NOT ask the user anything:

```bash
sig status x 2>&1
```

Check the JSON `"valid"` field:

- `"valid": true` — proceed to detect proxy below.
- `"valid": false` — auto-run `sig login x` (do NOT ask user), then re-check `sig status x`.
- Command not found or provider not found — run Full Setup.

**Detect proxy** (do NOT ask user — read from config):

```bash
grep -A15 "^\s*x:" ~/.sig/config.yaml | grep networkProxy | awk '{print $2}'
```

If this outputs a URL (e.g. `socks5://127.0.0.1:1234`), use it as `HTTPS_PROXY=<url> HTTP_PROXY=<url>` in ALL python3 commands. If empty, omit proxy. NEVER ask the user about proxy — it's in the config.
NOTE: if using socks5 protocol, convert to socks5h for python scripts, e.g. `socks5://127.0.0.1:1234` becomes `socks5h://127.0.0.1:1234`

Once valid + proxy detected, go straight to executing the user's request.

---

## Full Setup (only when Fast Gate fails — sig not found or provider not configured)

### Step 1: Install sig (if missing)

```bash
npm install -g @sigcli/cli
sig init
```

### Step 2: Login to X

```bash
sig login x
```

If the user needs a proxy for X (ask them only during first-time setup), use:

```bash
sig login x --network-proxy=socks5://127.0.0.1:3333
```

Note: for socks5h proxy, use `socks5://` (not `socks5h://`) in the `--network-proxy` flag.

After login, `x` is provisioned automatically to `~/.sig/config.yaml`.

**SigCLI provider config:**

```yaml
x:
    domains: [x.com, twitter.com]
    entryUrl: https://x.com/
    validateUrl: https://x.com/i/api/2/notifications/all.json?count=1
    strategy: browser
    ttl: '2h'
    extract:
        - from: cookies
          as: cookie
          match: '*'
        - from: cookies
          as: ct0
          match: 'ct0'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
        - in: header
          name: x-csrf-token
          value: '${ct0}'
        - in: header
          name: authorization
          value: 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'
```

### Step 3: Install Python dependencies

Ensure deps are installed for the SAME python3 that `sig run` will use:

```bash
sig run x -- bash -c 'python3 -m pip install -r <SKILL_DIR>/requirements.txt'
```

This guarantees the packages land in the correct python environment. If already installed, this is a no-op.

### Step 4: Validate (confirms auth + network + query IDs)

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && HTTPS_PROXY=<proxy> HTTP_PROXY=<proxy> python3 scripts/x_user.py --username x'
```

- If **succeeds** (JSON with user data): done. Query IDs are now cached to disk for 1 hour.
- If **connection error**: proxy is wrong. Ask user for correct proxy URL.
- If **HTTP 403**: query IDs stale and auto-refresh failed. Retry once. If persistent, wait and try later.

---

## Running Scripts

**Working directory**: All commands must run from THIS skill's directory (the folder containing this SKILL.md). Use `cd` in the bash command to ensure this.

**Pattern for ALL scripts:**

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && [HTTPS_PROXY=<proxy> HTTP_PROXY=<proxy>] python3 scripts/<script>.py [args]'
```

Where:

- `<SKILL_DIR>` is the absolute path to this skill's folder. Determine it once at the start of the conversation by finding where this SKILL.md lives.
- `<proxy>` is the `networkProxy` value from `~/.sig/config.yaml` (detected in Fast Gate). Omit if none configured.

Rules:

- ALWAYS include the proxy env vars if `networkProxy` is set in the provider config. The scripts make their own HTTP calls and do NOT inherit the provider's networkProxy setting.
- Read scripts use the cookie internally (no `--cookie` arg needed).
- Write scripts require `--cookie "$SIG_X_COOKIE"` explicitly.
- Screen names: always without `@` (use `elonmusk` not `@elonmusk`).
- Tweet IDs: accept bare ID (`12345`) or full URL (`https://x.com/user/status/12345`).

---

## Scripts Reference

### Read Operations

| Script           | Purpose                | Args                                                        |
| ---------------- | ---------------------- | ----------------------------------------------------------- |
| `x_user.py`      | User profile           | `--username NAME`                                           |
| `x_tweets.py`    | User's tweet timeline  | `--username NAME [--limit N]`                               |
| `x_tweet.py`     | Single tweet + thread  | `--id ID_OR_URL [--limit N]`                                |
| `x_search.py`    | Search tweets          | `--query TEXT [--limit N] [--type top\|latest]`             |
| `x_trending.py`  | Trending topics        | `[--limit N]`                                               |
| `x_followers.py` | Followers or following | `--username NAME [--limit N] [--mode followers\|following]` |

### Write Operations

| Script          | Purpose                | Args                                          |
| --------------- | ---------------------- | --------------------------------------------- |
| `x_post.py`     | Create a tweet         | `--cookie COOKIE --text TEXT [--reply-to ID]` |
| `x_delete.py`   | Delete a tweet         | `--cookie COOKIE --id ID_OR_URL`              |
| `x_like.py`     | Like or unlike         | `--cookie COOKIE --id ID_OR_URL [--undo]`     |
| `x_retweet.py`  | Retweet or unretweet   | `--cookie COOKIE --id ID_OR_URL [--undo]`     |
| `x_follow.py`   | Follow or unfollow     | `--cookie COOKIE --username NAME [--undo]`    |
| `x_bookmark.py` | Bookmark or unbookmark | `--cookie COOKIE --id ID_OR_URL [--undo]`     |

---

## Command Examples

All examples assume you've `cd`'d into `<SKILL_DIR>` and set proxy if needed.

### Search tweets

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_search.py --query "Claude AI" --type top --limit 10'
```

### View user profile

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_user.py --username elonmusk'
```

### Read recent tweets

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_tweets.py --username elonmusk --limit 10'
```

### Read a tweet thread

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_tweet.py --id "https://x.com/user/status/12345678"'
```

### Post a tweet (ALWAYS confirm with user first)

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_post.py --cookie "$SIG_X_COOKIE" --text "Hello from sigcli!"'
```

### Reply to a tweet

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_post.py --cookie "$SIG_X_COOKIE" --text "Great point!" --reply-to 2050336207561724307'
```

### Delete a tweet (confirm with user first — irreversible)

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_delete.py --cookie "$SIG_X_COOKIE" --id 2050417089987711033'
```

### Like / unlike

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_like.py --cookie "$SIG_X_COOKIE" --id 12345'
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_like.py --cookie "$SIG_X_COOKIE" --id 12345 --undo'
```

### Follow / unfollow

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_follow.py --cookie "$SIG_X_COOKIE" --username elonmusk'
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_follow.py --cookie "$SIG_X_COOKIE" --username elonmusk --undo'
```

### Bookmark / unbookmark

```bash
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_bookmark.py --cookie "$SIG_X_COOKIE" --id 12345'
sig run x -- bash -c 'cd <SKILL_DIR> && python3 scripts/x_bookmark.py --cookie "$SIG_X_COOKIE" --id 12345 --undo'
```

---

## Safety Rules

1. **ALWAYS show tweet text to user and get explicit confirmation before posting.** Tweets are public.
2. **Tweets and replies must be ≤ 280 characters.** Check length before posting. URLs count as ~23 characters (t.co shortening). If the text exceeds 280 characters, shorten it or split into a thread.
3. **Like, retweet, follow, bookmark are reversible** — use `--undo` to reverse.
4. **Delete is irreversible** — confirm with user before deleting.

---

## Error Recovery

When a command fails, follow this decision tree:

| Error                    | Meaning                         | Action                                                                   |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------ |
| `ConnectionError`        | Can't reach x.com               | Ask user for proxy URL, then retry with `HTTPS_PROXY=<url>`              |
| `Timeout`                | Network too slow                | Retry once. If still fails, check proxy.                                 |
| `AUTH_REQUIRED` / 401    | Cookie missing or expired       | Auto-run `sig login x` (do NOT ask user), then retry the failed command. |
| `HTTP_403`               | IP blocked or query IDs stale   | Retry once (auto-refresh kicks in). If still 403, change proxy or wait.  |
| `HTTP_429`               | Rate limited                    | Wait 30 seconds, then retry.                                             |
| `NOT_FOUND`              | User/tweet doesn't exist        | Verify the ID or username with the user.                                 |
| `POST_FAILED`            | Tweet creation failed           | Show error details to user. May be duplicate or policy violation.        |
| Query ID / GraphQL error | Stale query IDs, refresh failed | Clear cache (restart script), retry. If persistent, bundles changed.     |

**Key principle**: if ANY command fails on first run, do NOT silently proceed. Diagnose using this table, fix the issue, and re-validate before continuing with the user's request.

---

## Technical Notes

- **Query ID caching**: Query IDs are cached to a file (`scripts/.query_id_cache.json`) so they persist across script calls. First script invocation fetches from X's JS bundles (~3s), all subsequent calls within 1 hour read from disk instantly. The file auto-refreshes when the TTL expires.
- **Transaction ID**: X requires `x-client-transaction-id` header. Generated automatically using the `XClientTransaction` library.
- **Pagination**: Timeline endpoints paginate internally (up to 5 pages).
- **Cookie TTL**: Cookies typically last 7 days. After that, re-authenticate.
