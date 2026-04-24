---
name: hackernews
description: 'Interact with Hacker News (news.ycombinator.com) — browse top, new, and best stories, read item details and comment threads, look up user profiles, and search posts via Algolia. Use this skill whenever the user mentions Hacker News, HN, YCombinator news, ycombinator.com, news.ycombinator.com, wants to browse tech news, read HN discussions, search HN posts, or look up HN users. Also trigger when the user pastes an HN URL (e.g. news.ycombinator.com/item?id=12345). Keywords: Hacker News, HN, YC, ycombinator, tech news, Show HN, Ask HN, HN front page.'
---

# Hacker News

Browse, search, and read Hacker News stories, comments, and user profiles.

## Authentication

**No authentication is required.** All Hacker News APIs are public. No cookies, tokens, or `sig run` needed.

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

| Script          | Purpose                              | Auth |
| --------------- | ------------------------------------ | ---- |
| `hn_top.py`     | Top stories on the front page        | None |
| `hn_new.py`     | Newest stories                       | None |
| `hn_best.py`    | Best stories, Ask HN, Show HN, Jobs | None |
| `hn_item.py`    | Item detail + comment tree           | None |
| `hn_user.py`    | User profile + submissions           | None |
| `hn_search.py`  | Full-text search via Algolia         | None |

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
--type TYPE           Story type: "best" (default), "ask", "show", "job"
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

## Key Concepts

**Item types** -- Hacker News items have a `type` field: `story`, `comment`, `job`, `poll`, `pollopt`. Stories have `title`, `url`, `score`, and `descendants` (total comment count). Comments have `text` and `parent`.

**Item IDs** -- Numeric IDs found in URLs like `news.ycombinator.com/item?id=12345`. Get IDs from top/new/best/search results, then use with `hn_item.py`.

**Comment trees** -- Comments are nested via the `kids` array. `hn_item.py` recursively fetches comment trees up to `--depth` levels. Each comment includes `replies` for nested children.

**Story categories** -- Use `hn_best.py --type ask` for Ask HN, `--type show` for Show HN, `--type job` for job postings.

**Algolia search** -- `hn_search.py` uses the Algolia HN Search API for full-text search with filtering by type, author, and minimum points.

## Error Handling

| Error          | Cause                         | Fix                     |
| -------------- | ----------------------------- | ----------------------- |
| HTTP_404       | Item or user not found        | Check the ID / username |
| HTTP_429       | Rate limited by API           | Wait and retry          |
| SEARCH_ERROR   | Algolia API unavailable       | Try again later         |
| ERROR          | Network or unexpected failure | Check connectivity      |

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

1. `python3 scripts/hn_best.py --type ask --limit 20`

### Find high-scoring stories by an author

1. `python3 scripts/hn_search.py --query "" --author dang --points-min 100 --sort date`
