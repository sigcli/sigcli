---
name: x
description: 'Interact with X (Twitter) — view profiles, read tweets and threads, search posts, check trending topics, view followers, post tweets, like, retweet, follow users, and bookmark tweets. Use this skill whenever the user mentions X, Twitter, tweets, @handles, wants to browse X posts, search X, view user profiles, or interact with X content. Also trigger when the user pastes an x.com or twitter.com URL.'
---

# X (Twitter)

View profiles, read tweets, search posts, check trending topics, and interact with X/Twitter.

## Prerequisites

**Python dependencies** (install once):

```bash
pip install -r requirements.txt
```

**Network proxy** — X is blocked in some regions. If `x.com` is not directly reachable, set a SOCKS proxy:

```bash
export HTTPS_PROXY=socks5://127.0.0.1:3333
export HTTP_PROXY=socks5://127.0.0.1:3333
```

All scripts respect standard `HTTPS_PROXY`/`HTTP_PROXY` env vars. Set them BEFORE running any script. The sigcli config also supports `networkProxy` per provider.

## Authentication

**ALL operations require a session cookie.** Use `sig run x` to inject it:

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_search.py --query "AI agents" --limit 5'
```

The env var `SIG_X_COOKIE` is injected by `sig run x`. Read scripts use it internally via `XClient.create()`. Write scripts take it explicitly as `--cookie "$SIG_X_COOKIE"`.

### First-time login

X's login page blocks automated browsers. **Copy cookies manually from your browser:**

1. Open https://x.com/ in your browser and log in
2. Open DevTools (F12) → Network tab → pick any request → copy the `Cookie:` header value
3. You need at least `ct0` and `auth_token` cookies
4. Run:

```bash
sig login https://x.com/ --as x --cookie "ct0=<your-ct0>; auth_token=<your-token>"
```

### Re-authenticate when expired

```bash
sig status x          # Check if valid
sig logout x          # Clear old credentials
sig login https://x.com/ --as x --cookie "ct0=...; auth_token=..."
```

### Signet provider config (`~/.sig/config.yaml`)

```yaml
x:
    domains: [x.com, twitter.com]
    entryUrl: https://x.com/i/flow/login
    strategy: browser
    ttl: '7d'
    networkProxy: socks5h://127.0.0.1:3333
    required: [cookie.ct0, cookie.auth_token]
    extract:
        - from: cookies
          as: cookie
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
```

## How to Run Scripts

**Pattern for ALL scripts:**

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/<script>.py [args]'
```

For write operations, pass the cookie explicitly:

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_post.py --cookie "$SIG_X_COOKIE" --text "Hello"'
```

If proxy is not needed (X is directly reachable), omit the `HTTPS_PROXY=...` prefix.

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

## Workflow Examples

### Search tweets

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_search.py --query "Claude AI" --type top --limit 10'
```

### View a user profile

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_user.py --username elonmusk'
```

### Read recent tweets

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_tweets.py --username elonmusk --limit 10'
```

### Read a tweet thread

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_tweet.py --id "https://x.com/user/status/12345678"'
```

### Post a tweet (ALWAYS confirm with user first)

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_post.py --cookie "$SIG_X_COOKIE" --text "Hello from sigcli!"'
```

### Reply to a tweet

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_post.py --cookie "$SIG_X_COOKIE" --text "Great point!" --reply-to 2050336207561724307'
```

### Delete a tweet

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_delete.py --cookie "$SIG_X_COOKIE" --id 2050417089987711033'
```

### Like / unlike a tweet

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_like.py --cookie "$SIG_X_COOKIE" --id 12345'
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_like.py --cookie "$SIG_X_COOKIE" --id 12345 --undo'
```

### Follow / unfollow

```bash
sig run x -- bash -c 'HTTPS_PROXY=socks5://127.0.0.1:3333 python3 scripts/x_follow.py --cookie "$SIG_X_COOKIE" --username elonmusk'
```

## Safety Rules

1. **ALWAYS show tweet text to user and get explicit confirmation before posting.** Tweets are public.
2. **Like, retweet, follow, bookmark are reversible** — use `--undo` to reverse.
3. **Delete is irreversible** — confirm with user before deleting.

## Error Handling

| Error             | Cause                       | Fix                                                   |
| ----------------- | --------------------------- | ----------------------------------------------------- |
| `AUTH_REQUIRED`   | No cookie or missing ct0    | Run `sig login https://x.com/ --as x --cookie "..."`  |
| `HTTP_401`        | Cookie expired              | Re-authenticate (see above)                           |
| `HTTP_403`        | Rate limited or IP blocked  | Wait and retry; check proxy                           |
| `HTTP_429`        | Rate limited                | Wait a few seconds and retry                          |
| `NOT_FOUND`       | User or tweet doesn't exist | Verify the ID or username                             |
| `POST_FAILED`     | Tweet creation failed       | Check error details; may be duplicate or policy block |
| Timeout           | Network unreachable         | **Set HTTPS_PROXY** — X may be blocked in your region |
| `ConnectionError` | Can't reach x.com           | **Set HTTPS_PROXY** — X may be blocked in your region |

## Technical Notes

**Query ID auto-refresh** — X rotates GraphQL query IDs with each deployment. The client automatically fetches fresh IDs from X's JS bundles and caches them for 1 hour. No manual intervention needed.

**Transaction ID** — X requires an `x-client-transaction-id` header for API requests. The client generates this automatically using the `XClientTransaction` library (fetches X homepage + ondemand.s bundle on first call, then reuses).

**Screen names** — Always pass without `@`. Use `elonmusk` not `@elonmusk`.

**Tweet IDs** — Scripts accept bare IDs (`12345`) or full URLs (`https://x.com/user/status/12345`).

**Pagination** — Timeline endpoints paginate internally (up to 5 pages).
