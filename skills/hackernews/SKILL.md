---
name: hackernews
description: 'Interact with Hacker News (news.ycombinator.com) — browse top, new, and best stories, read item details and comment threads, look up user profiles, and search posts via Algolia. Use this skill whenever the user mentions Hacker News, HN, YCombinator news, ycombinator.com, news.ycombinator.com, wants to browse tech news, read HN discussions, search HN posts, or look up HN users. Also trigger when the user pastes an HN URL (e.g. news.ycombinator.com/item?id=12345). Keywords: Hacker News, HN, YC, ycombinator, tech news, Show HN, Ask HN, HN front page.'
---

# Hacker News

Browse, search, and read Hacker News stories, comments, and user profiles.

## Authentication

**Read operations** work without authentication. All Hacker News Firebase and Algolia APIs are public.

**Write operations** (submit, comment, vote) require a **session cookie**. Use `sig run` to inject it:

```bash
sig run hackernews -- bash -c 'python3 scripts/hn_vote.py --cookie "$SIG_HACKERNEWS_COOKIE" --id 12345'
```

The default Signet provider is `hackernews`. The env var is `SIG_HACKERNEWS_COOKIE`.

If a write script returns auth error, re-authenticate:

```bash
sig login https://news.ycombinator.com/login
```

**If browser automation fails**, copy cookies manually:

1. Open https://news.ycombinator.com/ and log in
2. DevTools (F12) → Application → Cookies → `news.ycombinator.com`
3. Copy the `user` cookie value (format: `username&token`)
4. Run: `sig login https://news.ycombinator.com/ --cookie "user=username&token"`

**Signet provider config:**

```yaml
hackernews:
    domains: ['news.ycombinator.com']
    entryUrl: https://news.ycombinator.com/login
    strategy: cookie
    config:
        requiredCookies: ['user']
```

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script         | Purpose                      | Auth |
| -------------- | ---------------------------- | ---- |
| `hn_top.py`    | Top stories (front page)     | None |
| `hn_new.py`    | Newest stories               | None |
| `hn_best.py`   | Best stories                 | None |
| `hn_ask.py`    | Ask HN stories               | None |
| `hn_show.py`   | Show HN stories              | None |
| `hn_jobs.py`   | Job postings                 | None |
| `hn_item.py`   | Item detail + comment tree   | None |
| `hn_user.py`   | User profile + submissions   | None |
| `hn_search.py` | Full-text search via Algolia | None |

### Write Operations

| Script          | Purpose        | Auth     |
| --------------- | -------------- | -------- |
| `hn_submit.py`  | Submit a story | Required |
| `hn_comment.py` | Post a comment | Required |
| `hn_vote.py`    | Upvote an item | Required |

### hn_top.py

```
--limit N             Max stories to fetch (default: 30)
```

### hn_new.py

```
--limit N             Max stories to fetch (default: 30)
```

### hn_best.py

```
--limit N             Max stories to fetch (default: 30)
```

### hn_ask.py

```
--limit N             Max stories to fetch (default: 30)
```

### hn_show.py

```
--limit N             Max stories to fetch (default: 30)
```

### hn_jobs.py

```
--limit N             Max jobs to fetch (default: 30)
```

### hn_item.py

```
--id ID               Item ID (required)
--depth N             Max comment tree depth (default: 2)
--comments-limit N    Max comments to fetch (default: 20)
```

### hn_user.py

```
--username NAME       HN username (required)
--include-submissions Include recent submitted item details (flag)
```

### hn_search.py

```
--query TEXT          Search query (required)
--type TYPE           Filter: "story", "comment", "ask_hn", "show_hn"
--sort SORT           Sort by: "relevance" (default) or "date"
--limit N             Max results (default: 30)
--author NAME         Filter by author username
--points-min N        Minimum points filter
```

### hn_submit.py

```
--cookie COOKIE       HN session cookie (required)
--title TEXT          Story title (required)
--url URL             URL to submit (for link posts)
--text TEXT           Text body (for Ask HN / text posts)
```

### hn_comment.py

```
--cookie COOKIE       HN session cookie (required)
--parent ID           Parent item ID — story or comment (required)
--text TEXT           Comment text (required)
```

### hn_vote.py

```
--cookie COOKIE       HN session cookie (required)
--id ID               Item ID to upvote (required)
```

## Safety

**Always show the user the title/body and get explicit confirmation before calling `hn_submit.py`.** Submissions are public.

**Always confirm before `hn_comment.py`.** Comments are public and cannot be deleted after a few minutes.

**`hn_vote.py` is reversible** — you can un-upvote by clicking the upvote button again on the HN website.

## Key Concepts

**Item types** -- Hacker News items have a `type` field: `story`, `comment`, `job`, `poll`, `pollopt`. Stories have `title`, `url`, `score`, and `descendants` (total comment count). Comments have `text` and `parent`.

**Item IDs** -- Numeric IDs found in URLs like `news.ycombinator.com/item?id=12345`. Get IDs from top/new/best/search results, then use with `hn_item.py`.

**Comment trees** -- Comments are nested via the `kids` array. `hn_item.py` recursively fetches comment trees up to `--depth` levels. Each comment includes `replies` for nested children.

**Story categories** -- Use `hn_ask.py` for Ask HN, `hn_show.py` for Show HN, `hn_jobs.py` for job postings.

**Algolia search** -- `hn_search.py` uses the Algolia HN Search API for full-text search with filtering by type, author, and minimum points.

## Error Handling

| Error        | Cause                         | Fix                     |
| ------------ | ----------------------------- | ----------------------- |
| HTTP_404     | Item or user not found        | Check the ID / username |
| HTTP_429     | Rate limited by API           | Wait and retry          |
| SEARCH_ERROR | Algolia API unavailable       | Try again later         |
| ERROR        | Network or unexpected failure | Check connectivity      |

## Workflow Examples

### Browse top stories

1. `python3 scripts/hn_top.py --limit 10`

### Read a specific story and its comments

1. `python3 scripts/hn_item.py --id 12345 --depth 3 --comments-limit 30`

### Search for topics

1. `python3 scripts/hn_search.py --query "Rust programming" --type story --limit 10`

### Look up a user

1. `python3 scripts/hn_user.py --username pg --include-submissions`

### Browse Ask HN posts

1. `python3 scripts/hn_ask.py --limit 20`

### Browse Show HN posts

1. `python3 scripts/hn_show.py --limit 20`

### Browse job postings

1. `python3 scripts/hn_jobs.py --limit 10`

### Find high-scoring stories by an author

1. `python3 scripts/hn_search.py --query "" --author dang --points-min 100 --sort date`

### Submit a story

1. **Show title/URL to user and get confirmation**
2. `sig run hackernews -- bash -c 'python3 scripts/hn_submit.py --cookie "$SIG_HACKERNEWS_COOKIE" --title "My Post" --url "https://example.com"'`

### Comment on a story

1. **Show comment text to user and get confirmation**
2. `sig run hackernews -- bash -c 'python3 scripts/hn_comment.py --cookie "$SIG_HACKERNEWS_COOKIE" --parent 12345 --text "Great article!"'`

### Upvote a story

1. `sig run hackernews -- bash -c 'python3 scripts/hn_vote.py --cookie "$SIG_HACKERNEWS_COOKIE" --id 12345'`
