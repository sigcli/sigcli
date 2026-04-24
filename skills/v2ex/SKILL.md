---
name: v2ex
description: 'Interact with V2EX (v2ex.com) — browse hot and latest topics, read topic details and replies, search posts, create topics, reply to discussions, thank posts, favorite topics/nodes, follow members, daily check-in. Use this skill whenever the user mentions V2EX, v2ex.com, wants to browse tech forum topics, read V2EX discussions, search V2EX posts, check V2EX notifications, create or reply to V2EX topics, or look up V2EX users/nodes. Also trigger when the user pastes a V2EX URL (e.g. v2ex.com/t/12345), mentions a V2EX node name, or asks about Chinese tech community discussions. Keywords: V2EX, v2ex, 论坛, 技术社区, 节点, 主题, 回复.'
---

# V2EX

Browse, search, read, and interact with V2EX — the creative workers' community.

## Authentication

This skill uses **cookie-based authentication** for full read/write access to V2EX. Use `sig run` to inject the session cookie:

```bash
sig run v2ex -- bash -c 'python3 scripts/v2ex_hot.py --cookie "$SIG_V2EX_COOKIE"'
```

The default Signet provider is `v2ex`. The env var is `SIG_V2EX_COOKIE`.

**Read-only operations** (hot topics, latest, topic detail, node info, member profile, search) work **without authentication** via the public V2EX API v1. The `--cookie` argument is optional for these scripts.

**Write operations** (create topic, reply, thank, favorite, follow, daily check-in, append) **require a valid session cookie**.

If a script returns 403 or auth error, re-authenticate:

```bash
sig login https://www.v2ex.com/
```

Then retry the `sig run` command.

**Signet provider config:**

```yaml
v2ex:
    domains: ['www.v2ex.com', 'v2ex.com']
    entryUrl: https://www.v2ex.com/signin
    strategy: cookie
```

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script                  | Purpose                            | Auth     |
| ----------------------- | ---------------------------------- | -------- |
| `v2ex_hot.py`           | Hot topics of the day              | Optional |
| `v2ex_latest.py`        | Latest topics                      | Optional |
| `v2ex_topic.py`         | Topic detail + replies             | Optional |
| `v2ex_node.py`          | Node info + topics, list nodes     | Optional |
| `v2ex_member.py`        | Member profile + topics            | Optional |
| `v2ex_search.py`        | Full-text search via SOV2EX        | None     |
| `v2ex_notifications.py` | User notifications                 | Required |
| `v2ex_profile.py`       | Authenticated user profile/balance | Required |

### Write Operations

| Script             | Purpose                           | Auth     |
| ------------------ | --------------------------------- | -------- |
| `v2ex_create.py`   | Create a new topic                | Required |
| `v2ex_reply.py`    | Reply to a topic                  | Required |
| `v2ex_thank.py`    | Thank a topic or reply            | Required |
| `v2ex_favorite.py` | Favorite/unfavorite topic or node | Required |
| `v2ex_follow.py`   | Follow/unfollow/block/unblock     | Required |
| `v2ex_daily.py`    | Daily sign-in reward              | Required |
| `v2ex_append.py`   | Append supplement to own topic    | Required |

### v2ex_hot.py

```
--cookie COOKIE       V2EX session cookie (optional)
```

### v2ex_latest.py

```
--cookie COOKIE       V2EX session cookie (optional)
```

### v2ex_topic.py

```
--cookie COOKIE       V2EX session cookie (optional)
--id ID               Topic ID (required)
--page N              Reply page number (default: 1)
```

### v2ex_node.py

```
--cookie COOKIE       V2EX session cookie (optional)
--name NAME           Node name (e.g., "python", "apple")
--page N              Page number for topic listing (default: 1)
--list-all            List all available nodes (flag)
```

### v2ex_member.py

```
--cookie COOKIE       V2EX session cookie (optional)
--username NAME       Member username (required)
--include-topics      Also fetch member's recent topics (flag)
```

### v2ex_search.py

```
--query TEXT          Search query (required)
--size N             Max results (default: 20)
--sort FIELD         Sort by: "sumup" (relevance, default) or "created"
--node NAME          Filter by node name (optional)
--username NAME      Filter by author (optional)
```

### v2ex_notifications.py

```
--cookie COOKIE       V2EX session cookie (required)
--page N              Page number (default: 1)
```

### v2ex_profile.py

```
--cookie COOKIE       V2EX session cookie (required)
```

### v2ex_create.py

```
--cookie COOKIE       V2EX session cookie (required)
--node NAME           Target node name (required, e.g., "python")
--title TEXT          Topic title (required)
--content TEXT        Topic body content (required)
--syntax SYNTAX       Content syntax: "default" or "markdown" (default: "default")
```

### v2ex_reply.py

```
--cookie COOKIE       V2EX session cookie (required)
--topic-id ID         Topic ID to reply to (required)
--content TEXT        Reply content (required)
```

### v2ex_thank.py

```
--cookie COOKIE       V2EX session cookie (required)
--type TYPE           "topic" or "reply" (required)
--id ID               Topic ID or Reply ID (required)
```

### v2ex_favorite.py

```
--cookie COOKIE       V2EX session cookie (required)
--type TYPE           "topic" or "node" (required)
--id ID               Topic ID or Node ID (required)
--undo                Unfavorite instead (flag)
```

### v2ex_follow.py

```
--cookie COOKIE       V2EX session cookie (required)
--action ACTION       "follow", "unfollow", "block", or "unblock" (required)
--id ID               Member numeric ID (required)
```

### v2ex_daily.py

```
--cookie COOKIE       V2EX session cookie (required)
```

### v2ex_append.py

```
--cookie COOKIE       V2EX session cookie (required)
--topic-id ID         Topic ID to append to (required)
--content TEXT        Supplement content (required)
```

## Safety

**Always show the user the content (title, body, node) and get explicit confirmation before calling `v2ex_create.py`, `v2ex_reply.py`, or `v2ex_append.py`.** These actions post publicly and cannot be easily undone.

**`v2ex_thank.py` costs coins and is irreversible — confirm with the user first.**

## Key Concepts

**Nodes** — V2EX organizes topics into nodes (like subreddits). Examples: `python`, `apple`, `jobs`, `create`, `programmer`, `shanghai`. Use `v2ex_node.py --list-all` to see all.

**Once token** — V2EX uses a CSRF token called `once` for all write operations. The client extracts it automatically from HTML pages before each mutation.

**Topic IDs** — Numeric IDs (e.g., `12345`). Found in URLs like `v2ex.com/t/12345`. Get from hot/latest/search results, then use with `v2ex_topic.py`.

**Member IDs vs usernames** — Profiles use usernames, but follow/block actions require numeric member IDs. `v2ex_member.py` returns both.

**Daily check-in** — V2EX awards coins for daily sign-in. Use `v2ex_daily.py` to redeem.

**Search** — Uses the SOV2EX third-party search engine (sov2ex.com) which indexes V2EX content for full-text search.

## Proxy

V2EX is blocked by firewalls in some regions. If scripts fail with `Connection reset by peer` or timeout errors, set a proxy via environment variables:

```bash
# SOCKS5 proxy
HTTPS_PROXY=socks5://localhost:1080 HTTP_PROXY=socks5://localhost:1080 python3 scripts/v2ex_hot.py

# HTTP proxy
HTTPS_PROXY=http://localhost:8080 HTTP_PROXY=http://localhost:8080 python3 scripts/v2ex_hot.py
```

For SOCKS5 proxies, `pysocks` must be installed: `pip install pysocks`

With `sig run`, pass the proxy env vars through:

```bash
HTTPS_PROXY=socks5://localhost:1080 HTTP_PROXY=socks5://localhost:1080 \
  sig run v2ex -- bash -c 'python3 scripts/v2ex_hot.py --cookie "$SIG_V2EX_COOKIE"'
```

## Error Handling

| Error            | Cause                        | Fix                              |
| ---------------- | ---------------------------- | -------------------------------- |
| 403 Forbidden    | Session expired / no cookie  | Re-authenticate via `sig login`  |
| 302 Redirect     | Not logged in                | Check cookie is valid            |
| `ONCE_NOT_FOUND` | Failed to extract CSRF token | Session may be expired, re-login |
| `RATE_LIMITED`   | Too many requests            | Wait and retry                   |
| `SEARCH_ERROR`   | SOV2EX service unavailable   | Try again later                  |

## Workflow Examples

### Browse hot topics

1. `sig run v2ex -- bash -c 'python3 scripts/v2ex_hot.py --cookie "$SIG_V2EX_COOKIE"'`

### Read a specific topic and its replies

1. `sig run v2ex -- bash -c 'python3 scripts/v2ex_topic.py --cookie "$SIG_V2EX_COOKIE" --id 12345 --page 1'`

### Search for topics

1. `python3 scripts/v2ex_search.py --query "Docker 部署" --size 10`

### Create a new topic

1. **Show title/body/node to user and get confirmation**
2. `sig run v2ex -- bash -c 'python3 scripts/v2ex_create.py --cookie "$SIG_V2EX_COOKIE" --node python --title "Question about asyncio" --content "How do I..."'`

### Reply to a topic

1. Read the topic first: `sig run v2ex -- bash -c 'python3 scripts/v2ex_topic.py --cookie "$SIG_V2EX_COOKIE" --id 12345'`
2. **Show reply to user and get confirmation**
3. `sig run v2ex -- bash -c 'python3 scripts/v2ex_reply.py --cookie "$SIG_V2EX_COOKIE" --topic-id 12345 --content "I think you should..."'`

### Check notifications

1. `sig run v2ex -- bash -c 'python3 scripts/v2ex_notifications.py --cookie "$SIG_V2EX_COOKIE"'`

### Daily check-in

1. `sig run v2ex -- bash -c 'python3 scripts/v2ex_daily.py --cookie "$SIG_V2EX_COOKIE"'`

### Follow a member

1. Look up member: `sig run v2ex -- bash -c 'python3 scripts/v2ex_member.py --cookie "$SIG_V2EX_COOKIE" --username livid'`
2. Follow: `sig run v2ex -- bash -c 'python3 scripts/v2ex_follow.py --cookie "$SIG_V2EX_COOKIE" --action follow --id 1'`
