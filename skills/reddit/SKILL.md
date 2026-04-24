---
name: reddit
description: 'Interact with Reddit — browse subreddits, read posts and comments, search content, view user profiles. Use this skill whenever the user mentions Reddit, r/, subreddit, wants to browse Reddit posts, read Reddit discussions, search Reddit, or look up Reddit users. Also trigger when the user pastes a Reddit URL (e.g. reddit.com/r/programming/...) or mentions a subreddit name.'
---

# Reddit

Browse subreddits, read posts and comments, search content, and view user profiles via Reddit's public JSON API.

## Authentication

No authentication is required. Reddit's public JSON API is used for read-only access. All scripts work without any credentials or `sig run`.

```bash
python scripts/reddit_hot.py --subreddit programming --limit 10
```

If you encounter HTTP 429 (rate limited), wait a few seconds and retry. The client includes a `User-Agent` header to reduce rate limiting.

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

| Script                | Purpose                          |
| --------------------- | -------------------------------- |
| `reddit_hot.py`       | Get hot posts from a subreddit   |
| `reddit_top.py`       | Get top posts from a subreddit   |
| `reddit_post.py`      | Get post detail with comments    |
| `reddit_search.py`    | Search Reddit posts              |
| `reddit_user.py`      | View user profile and activity   |
| `reddit_subreddit.py` | Get subreddit info               |

### reddit_hot.py

```
--subreddit NAME      Subreddit name without r/ prefix (default: all)
--limit N             Max posts to return (default: 25)
```

### reddit_top.py

```
--subreddit NAME      Subreddit name without r/ prefix (default: all)
--time PERIOD         Time period: hour, day, week, month, year, all (default: day)
--limit N             Max posts to return (default: 25)
```

### reddit_post.py

```
--id ID               Post ID (required, e.g. "1k2x3y")
--comments-limit N    Max top-level comments (default: 20)
--sort SORT           Comment sort: best, top, new (default: best)
```

### reddit_search.py

```
--query TEXT          Search query (required)
--subreddit NAME     Search within a specific subreddit (optional)
--sort SORT          Sort: relevance, hot, top, new, comments (default: relevance)
--time PERIOD        Time filter: hour, day, week, month, year, all (default: all)
--limit N            Max results (default: 25)
```

### reddit_user.py

```
--username NAME       Reddit username without u/ prefix (required)
--include-posts       Include user's recent posts
--include-comments    Include user's recent comments
```

### reddit_subreddit.py

```
--name NAME           Subreddit name without r/ prefix (required)
```

## Key Concepts

**Subreddit names** — Always pass without the `r/` prefix. For example, use `programming` not `r/programming`.

**Post IDs** — The alphanumeric identifier from a Reddit URL. For `reddit.com/r/python/comments/1k2x3y/...`, the post ID is `1k2x3y`.

**Time periods** — Used by `reddit_top.py` and `reddit_search.py`. Valid values: `hour`, `day`, `week`, `month`, `year`, `all`.

**Pagination** — List endpoints return an `after` token. Pass it as `--after` on a subsequent call to get the next page (not yet exposed as CLI args — use the returned `after` value programmatically).

**NSFW content** — Posts flagged as NSFW include `"over_18": true` in the response.

## Error Handling

| Error          | Cause                    | Fix                                          |
| -------------- | ------------------------ | -------------------------------------------- |
| HTTP_403       | Subreddit is private     | Use a different subreddit                    |
| HTTP_404       | Subreddit/user not found | Check the name is spelled correctly          |
| HTTP_429       | Rate limited by Reddit   | Wait a few seconds and retry                 |
| HTTP_503       | Reddit is temporarily down | Wait and retry                             |

## Workflow Examples

### Browse hot posts in a subreddit

1. `python scripts/reddit_hot.py --subreddit programming --limit 10`
2. Get more posts: increase `--limit` or use the `after` token from the response

### Find top posts of the week

1. `python scripts/reddit_top.py --subreddit python --time week --limit 10`
2. Change `--time` to `month` or `year` for longer periods

### Read a specific post with comments

1. Find a post ID from hot/top/search results
2. `python scripts/reddit_post.py --id 1k2x3y --comments-limit 30 --sort top`

### Search for a topic

1. `python scripts/reddit_search.py --query "machine learning" --sort top --time month`
2. Search within a subreddit: `python scripts/reddit_search.py --query "async" --subreddit python`

### Look up a user

1. `python scripts/reddit_user.py --username spez`
2. Include activity: `python scripts/reddit_user.py --username spez --include-posts --include-comments`

### Get subreddit info

1. `python scripts/reddit_subreddit.py --name python`
