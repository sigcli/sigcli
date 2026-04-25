---
name: x
description: 'Interact with X (Twitter) — view profiles, read tweets and threads, search posts, check trending topics, view followers, post tweets, like, retweet, follow users, and bookmark tweets. Use this skill whenever the user mentions X, Twitter, tweets, @handles, wants to browse X posts, search X, view user profiles, or interact with X content. Also trigger when the user pastes an x.com or twitter.com URL.'
---

# X (Twitter)

View profiles, read tweets, search posts, check trending topics, and interact with X/Twitter.

## Authentication

**Read operations** (user profile, tweets, tweet detail, search) use X's public bearer token — no session cookie needed.

**Write operations** (post, like, retweet, follow, bookmark) and some read operations (trending, followers) require a **session cookie**. Use `sig run` to inject it:

```bash
sig run x -- bash -c 'python3 scripts/x_like.py --cookie "$SIG_X_COOKIE" --id 12345'
```

The default Signet provider is `x`. The env var is `SIG_X_COOKIE`.

If a script returns an auth error, re-authenticate:

```bash
sig login https://x.com/
```

**Note:** X's login page may block automated browsers. If `sig login` fails, copy the cookie manually:

1. Open https://x.com/ in your browser and log in
2. Open DevTools (F12) → Application → Cookies → `x.com`
3. Copy the full cookie string (you need at least `ct0` and `auth_token`)
4. Run: `sig login https://x.com/ --as x --cookie "ct0=<your-ct0>; auth_token=<your-token>"`

**Signet provider config:**

```yaml
x:
    domains: ['x.com', 'twitter.com']
    entryUrl: https://x.com/i/flow/login
    strategy: cookie
    config:
        ttl: '7d'
        requiredCookies: ['ct0', 'auth_token']
```

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script           | Purpose                | Auth     |
| ---------------- | ---------------------- | -------- |
| `x_user.py`      | User profile           | None     |
| `x_tweets.py`    | User's tweet timeline  | None     |
| `x_tweet.py`     | Single tweet + thread  | None     |
| `x_search.py`    | Search tweets          | None     |
| `x_trending.py`  | Trending topics        | Required |
| `x_followers.py` | Followers or following | Required |

### Write Operations

| Script          | Purpose                | Auth     |
| --------------- | ---------------------- | -------- |
| `x_post.py`     | Create a tweet         | Required |
| `x_like.py`     | Like or unlike         | Required |
| `x_retweet.py`  | Retweet or unretweet   | Required |
| `x_follow.py`   | Follow or unfollow     | Required |
| `x_bookmark.py` | Bookmark or unbookmark | Required |

### x_user.py

```
--username NAME       Screen name without @ (required)
```

### x_tweets.py

```
--username NAME       Screen name with or without @ (required)
--limit N             Max tweets to return (default: 20)
```

### x_tweet.py

```
--id ID               Tweet ID or full URL (required)
--limit N             Max tweets in thread (default: 50)
```

### x_search.py

```
--query TEXT          Search query (required)
--limit N            Max results (default: 20)
--type TYPE          Result type: latest, top (default: latest)
```

### x_trending.py

```
--limit N            Number of trends (default: 20)
```

### x_followers.py

```
--username NAME       Screen name without @ (required)
--limit N             Max users (default: 50)
--mode MODE           List type: followers, following (default: followers)
```

### x_post.py

```
--cookie COOKIE       X session cookie (required)
--text TEXT           Tweet text content (required)
--reply-to ID        Tweet ID to reply to (optional)
```

### x_like.py

```
--cookie COOKIE       X session cookie (required)
--id ID               Tweet ID or URL (required)
--undo                Unlike instead of like (flag)
```

### x_retweet.py

```
--cookie COOKIE       X session cookie (required)
--id ID               Tweet ID or URL (required)
--undo                Undo retweet (flag)
```

### x_follow.py

```
--cookie COOKIE       X session cookie (required)
--username NAME       Screen name without @ (required)
--undo                Unfollow instead of follow (flag)
```

### x_bookmark.py

```
--cookie COOKIE       X session cookie (required)
--id ID               Tweet ID or URL (required)
--undo                Remove bookmark (flag)
```

## Safety

**Always show the user the tweet text and get explicit confirmation before calling `x_post.py`.** Tweets are public.

**`x_like.py`, `x_retweet.py`, `x_follow.py`, and `x_bookmark.py` are reversible** — use `--undo` to reverse the action.

## Key Concepts

**Screen names** — Always pass without the `@` prefix. Use `elonmusk` not `@elonmusk`.

**Tweet IDs** — Scripts accept bare IDs (`12345`) or full URLs (`https://x.com/user/status/12345`). The ID is extracted automatically.

**GraphQL API** — X uses a GraphQL API with operation-specific query IDs. These IDs may change periodically; the client includes fallback defaults.

**ct0 CSRF token** — Write operations require the `ct0` cookie value as a CSRF token. The client extracts it automatically from the session cookie.

**Bearer token** — X uses a public bearer token embedded in its frontend JS. This is the same for all users and is used for all API requests.

**Pagination** — Timeline endpoints support cursor-based pagination handled internally by the scripts (up to 5 pages).

## Error Handling

| Error         | Cause                     | Fix                            |
| ------------- | ------------------------- | ------------------------------ |
| HTTP_401      | Invalid or expired cookie | Run `sig login https://x.com/` |
| HTTP_403      | Rate limited or blocked   | Wait and retry                 |
| HTTP_429      | Rate limited              | Wait a few seconds and retry   |
| NOT_FOUND     | User or tweet not found   | Check the ID or username       |
| AUTH_REQUIRED | No cookie for write op    | Run `sig login` and retry      |
| POST_FAILED   | Tweet creation failed     | Check error details            |
| PARSE_ERROR   | Unexpected API response   | API may have changed           |

## Workflow Examples

### View a user profile

1. `python3 scripts/x_user.py --username elonmusk`

### Read recent tweets

1. `python3 scripts/x_tweets.py --username elonmusk --limit 10`

### Read a tweet thread

1. `python3 scripts/x_tweet.py --id 12345678 --limit 30`
2. Or with URL: `python3 scripts/x_tweet.py --id "https://x.com/user/status/12345678"`

### Search for tweets

1. `python3 scripts/x_search.py --query "machine learning" --type top --limit 10`

### Check trending topics

1. `sig run x -- python3 scripts/x_trending.py --limit 10`

### View followers

1. `sig run x -- bash -c 'python3 scripts/x_followers.py --username elonmusk --limit 20 --mode followers'`

### Post a tweet

1. **Show tweet text to user and get confirmation**
2. `sig run x -- bash -c 'python3 scripts/x_post.py --cookie "$SIG_X_COOKIE" --text "Hello from sigcli!"'`

### Like a tweet

1. `sig run x -- bash -c 'python3 scripts/x_like.py --cookie "$SIG_X_COOKIE" --id 12345'`

### Retweet

1. `sig run x -- bash -c 'python3 scripts/x_retweet.py --cookie "$SIG_X_COOKIE" --id 12345'`

### Follow a user

1. `sig run x -- bash -c 'python3 scripts/x_follow.py --cookie "$SIG_X_COOKIE" --username elonmusk'`

### Bookmark a tweet

1. `sig run x -- bash -c 'python3 scripts/x_bookmark.py --cookie "$SIG_X_COOKIE" --id 12345'`
