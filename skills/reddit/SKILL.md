---
name: reddit
description: 'Interact with Reddit — browse subreddits, read posts and comments, search content, view user profiles, post comments, vote, save posts, subscribe to subreddits. Use this skill whenever the user mentions Reddit, r/, subreddit, wants to browse Reddit posts, read Reddit discussions, search Reddit, look up Reddit users, or interact with Reddit content. Also trigger when the user pastes a Reddit URL (e.g. reddit.com/r/programming/...) or mentions a subreddit name.'
---

# Reddit

Browse subreddits, read posts and comments, search content, view user profiles, and interact with Reddit.

## Skill Directory

`<SKILL_DIR>` is the directory containing this SKILL.md file. Determine it ONCE at the start and reuse it.

## Fast Gate (run this FIRST, every time)

Run these commands silently — do NOT ask the user anything:

```bash
sig status reddit 2>&1
```

Check the JSON `"valid"` field:

- `"valid": true` — proceed to detect proxy below.
- `"valid": false` — auto-run `sig login reddit` (do NOT ask user), then re-check `sig status reddit`.
- Command not found or provider not found — run Full Setup (see Authentication section).

**Detect proxy** (do NOT ask user — read from config):

```bash
grep -A15 "^\s*reddit:" ~/.sig/config.yaml | grep networkProxy | awk '{print $2}'
```

If this outputs a URL (e.g. `socks5://127.0.0.1:1234`), use it as `HTTPS_PROXY=<url> HTTP_PROXY=<url>` in ALL python3 commands. If empty, omit proxy. NEVER ask the user about proxy — it's in the config.
NOTE: if using socks5 protocol, convert to socks5h for python scripts, e.g. `socks5://127.0.0.1:1234` becomes `socks5h://127.0.0.1:1234`

Once valid + proxy detected, go straight to executing the user's request.

---

## Authentication

**ALWAYS configure the provider first.** Run `sig providers` — if the provider is not listed:

1. Read `references/provider-config.yaml` and append the block to `~/.sig/config.yaml` under `providers:`
2. Ask the user if they need a proxy to access this site (if yes, add `networkProxy: <url>` under the provider)
3. Run `sig login <provider>` (with `--network-proxy` if proxy was specified)

Do this automatically before any operation — never skip because reads may work without auth.

**Read operations** work without authentication via Reddit's public JSON API. No credentials needed.

**Write operations** (comment, vote, save, subscribe, submit, edit, delete) require a **session cookie**. Use `sig run` to inject it:

```bash
sig run reddit -- bash -c 'python3 scripts/reddit_comment.py --cookie "$SIG_REDDIT_COOKIE" --parent t3_1abc --text "Great post!"'
```

The default SigCLI provider is `reddit`. The env var is `SIG_REDDIT_COOKIE`.

If a write script returns auth error, re-authenticate automatically (do NOT ask the user):

```bash
sig login reddit
```

Then retry the failed command. `sig login` runs headless browser extraction and completes in seconds without user interaction.

**SigCLI provider config:**

```yaml
reddit:
    domains: [www.reddit.com, reddit.com]
    entryUrl: https://www.reddit.com/
    validateUrl: https://www.reddit.com/prefs/friends
    strategy: browser
    ttl: '2h'
    extract:
        - from: cookies
          as: cookie
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
```

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script                | Purpose                    | Auth |
| --------------------- | -------------------------- | ---- |
| `reddit_hot.py`       | Hot posts from a subreddit | None |
| `reddit_top.py`       | Top posts from a subreddit | None |
| `reddit_new.py`       | New or rising posts        | None |
| `reddit_popular.py`   | Popular posts (/r/popular) | None |
| `reddit_post.py`      | Post detail with comments  | None |
| `reddit_search.py`    | Search Reddit posts        | None |
| `reddit_user.py`      | User profile and activity  | None |
| `reddit_subreddit.py` | Subreddit info             | None |

### Write Operations

| Script                | Purpose                | Auth     |
| --------------------- | ---------------------- | -------- |
| `reddit_submit.py`    | Create a new post      | Required |
| `reddit_manage.py`    | Edit or delete post    | Required |
| `reddit_comment.py`   | Post a comment         | Required |
| `reddit_vote.py`      | Upvote/downvote/unvote | Required |
| `reddit_save.py`      | Save or unsave a post  | Required |
| `reddit_subscribe.py` | Subscribe/unsubscribe  | Required |

### reddit_hot.py

```
--subreddit NAME      Subreddit name without r/ prefix (default: all)
--limit N             Max posts to return (default: 25)
--after TOKEN         Pagination token from previous response
```

### reddit_top.py

```
--subreddit NAME      Subreddit name without r/ prefix (default: all)
--time PERIOD         Time period: hour, day, week, month, year, all (default: day)
--limit N             Max posts to return (default: 25)
--after TOKEN         Pagination token from previous response
```

### reddit_new.py

```
--subreddit NAME      Subreddit name (default: all)
--sort SORT           Sort: new, rising (default: new)
--limit N             Max posts (default: 25)
--after TOKEN         Pagination token
```

### reddit_popular.py

```
--limit N             Max posts (default: 25)
--after TOKEN         Pagination token
```

### reddit_post.py

```
--id ID               Post ID, fullname (t3_xxx), or full Reddit URL (required)
--comments-limit N    Max top-level comments (default: 20)
--sort SORT           Comment sort: best, top, new, controversial, old (default: best)
--depth N             Max comment tree depth (0=unlimited, default: 0)
```

### reddit_search.py

```
--query TEXT          Search query (required)
--subreddit NAME     Search within a specific subreddit (optional)
--sort SORT          Sort: relevance, hot, top, new, comments (default: relevance)
--time PERIOD        Time filter: hour, day, week, month, year, all (default: all)
--limit N            Max results (default: 25)
--after TOKEN        Pagination token
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

### reddit_submit.py

```
--cookie COOKIE       Reddit session cookie (required)
--subreddit NAME      Subreddit to post in (required)
--title TEXT          Post title (required)
--kind KIND           Post type: self, link (default: self)
--text TEXT           Post body text (for self posts)
--url URL             URL to share (for link posts)
--flair-id ID         Flair template ID (from subreddit flair list)
--flair-text TEXT     Flair text
```

### reddit_manage.py

```
--cookie COOKIE       Reddit session cookie (required)
--id ID               Post/comment ID or fullname (required)
--action ACTION       Action: edit, delete (required)
--text TEXT           New text content (required for edit)
```

### reddit_comment.py

```
--cookie COOKIE       Reddit session cookie (required)
--parent ID           Parent fullname: t3_xxx (reply to post) or t1_xxx (reply to comment)
--text TEXT           Comment text in markdown (required)
```

### reddit_vote.py

```
--cookie COOKIE       Reddit session cookie (required)
--id ID               Post/comment ID or fullname (t3_xxx / t1_xxx)
--direction DIR       Vote: up, down, or none (required)
```

### reddit_save.py

```
--cookie COOKIE       Reddit session cookie (required)
--id ID               Post/comment ID or fullname
--undo                Unsave instead of save (flag)
```

### reddit_subscribe.py

```
--cookie COOKIE       Reddit session cookie (required)
--subreddit NAME      Subreddit name (required)
--undo                Unsubscribe instead of subscribe (flag)
```

## Safety

**Always show the user the title/body and get explicit confirmation before calling `reddit_submit.py` or `reddit_comment.py`.** Posts and comments are public. Posts can be edited/deleted via `reddit_manage.py`.

**`reddit_vote.py` and `reddit_subscribe.py` are reversible** — use `--direction none` to remove a vote, `--undo` to unsubscribe.

## Key Concepts

**Subreddit names** — Always pass without the `r/` prefix. Use `programming` not `r/programming`.

**Post IDs** — `reddit_post.py` accepts: bare ID (`1k2x3y`), fullname (`t3_1k2x3y`), full URL (`https://www.reddit.com/r/python/comments/1k2x3y/...`), or short link (`https://redd.it/1k2x3y`).

**Fullnames** — Reddit identifies objects with type prefixes: `t1_` (comment), `t3_` (post). Write scripts accept bare IDs or fullnames.

**OAuth Bearer** — Write operations use the `token_v2` cookie value as a Bearer token against `oauth.reddit.com`. The client extracts it automatically from the session cookie.

**Time periods** — Used by `reddit_top.py` and `reddit_search.py`. Valid: `hour`, `day`, `week`, `month`, `year`, `all`.

**Pagination** — List endpoints return an `after` token. Pass it as `--after` on the next call to get the next page.

**NSFW content** — Posts flagged as NSFW include `"over_18": true` in the response.

## Error Handling

| Error           | Cause                      | Fix                                                   |
| --------------- | -------------------------- | ----------------------------------------------------- |
| HTTP_403        | Subreddit is private       | Use a different subreddit                             |
| HTTP_404        | Subreddit/user not found   | Check the name is spelled correctly                   |
| HTTP_429        | Rate limited by Reddit     | Wait a few seconds and retry                          |
| HTTP_503        | Reddit is temporarily down | Wait and retry                                        |
| Timeout         | Network blocked or slow    | Check proxy config; retry with `HTTPS_PROXY`          |
| ConnectionError | Can't reach reddit.com     | Proxy is missing or wrong; check `~/.sig/config.yaml` |
| AUTH_REQUIRED   | No cookie for write op     | Auto-run `sig login` (no user prompt needed), retry   |
| NO_TOKEN        | No token_v2 in cookie      | Auto-run `sig login` (no user prompt needed), retry   |
| COMMENT_FAILED  | Comment rejected           | Check error details                                   |
| SUBMIT_FAILED   | Post creation rejected     | Check subreddit rules                                 |
| EDIT_FAILED     | Edit rejected              | Must be the author                                    |

## Workflow Examples

All commands below assume you've detected proxy via Fast Gate. If `networkProxy` is set, prefix ALL python3 commands with `HTTPS_PROXY=<proxy> HTTP_PROXY=<proxy>`. For socks5 proxies, use `socks5h://` in the env var.

### Browse hot posts

1. `cd <SKILL_DIR> && HTTPS_PROXY=<proxy> HTTP_PROXY=<proxy> python3 scripts/reddit_hot.py --subreddit programming --limit 10`
2. Get next page: `python3 scripts/reddit_hot.py --subreddit programming --limit 10 --after t3_xxx`

### Browse popular posts

1. `python3 scripts/reddit_popular.py --limit 10`

### Find top posts of the week

1. `python3 scripts/reddit_top.py --subreddit python --time week --limit 10`

### Read a post with comments

1. `python3 scripts/reddit_post.py --id 1k2x3y --comments-limit 30 --sort top`
2. Or use a full URL: `python3 scripts/reddit_post.py --id "https://www.reddit.com/r/python/comments/1k2x3y/..." --sort best`

### Search for a topic

1. `python3 scripts/reddit_search.py --query "machine learning" --sort top --time month`

### Create a post

1. **Show title/body to user and get confirmation**
2. `sig run reddit -- bash -c 'python3 scripts/reddit_submit.py --cookie "$SIG_REDDIT_COOKIE" --subreddit test --title "My Post" --text "Hello world"'`

### Edit or delete a post

1. Edit: `sig run reddit -- bash -c 'python3 scripts/reddit_manage.py --cookie "$SIG_REDDIT_COOKIE" --id t3_abc123 --action edit --text "Updated content"'`
2. Delete: `sig run reddit -- bash -c 'python3 scripts/reddit_manage.py --cookie "$SIG_REDDIT_COOKIE" --id t3_abc123 --action delete'`

### Post a comment

1. **Show comment text to user and get confirmation**
2. `sig run reddit -- bash -c 'python3 scripts/reddit_comment.py --cookie "$SIG_REDDIT_COOKIE" --parent t3_1k2x3y --text "Great post!"'`

### Upvote a post

1. `sig run reddit -- bash -c 'python3 scripts/reddit_vote.py --cookie "$SIG_REDDIT_COOKIE" --id t3_1k2x3y --direction up'`

### Subscribe to a subreddit

1. `sig run reddit -- bash -c 'python3 scripts/reddit_subscribe.py --cookie "$SIG_REDDIT_COOKIE" --subreddit python'`
