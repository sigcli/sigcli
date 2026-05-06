---
name: zhihu
description: 'Interact with Zhihu (zhihu.com) — browse hot questions, read answers, search content, view topics, check user profiles. Use this skill whenever the user mentions Zhihu, 知乎, zhihu.com, wants to browse Chinese Q&A content, read Zhihu answers, search Zhihu questions, check Zhihu hot list, or look up Zhihu users/topics. Also trigger when the user pastes a Zhihu URL (e.g. zhihu.com/question/12345), mentions a Zhihu topic, or asks about Chinese knowledge sharing platforms.'
---

# Zhihu

Browse, search, read, and interact with Zhihu — China's largest Q&A platform.

## Skill Directory

`<SKILL_DIR>` is the directory containing this SKILL.md file. Determine it ONCE at the start and reuse it.

## Fast Gate (run this FIRST, every time)

Run these commands silently — do NOT ask the user anything:

```bash
sig status zhihu 2>&1
```

Check the JSON `"valid"` field:

- `"valid": true` — proceed to detect proxy below.
- `"valid": false` — run `sig login zhihu`, then re-check `sig status zhihu`.
- Command not found or provider not found — run Full Setup (see Authentication section).

**Detect proxy** (do NOT ask user — read from config):

```bash
grep -A15 "^\s*zhihu:" ~/.sig/config.yaml | grep networkProxy | awk '{print $2}'
```

If this outputs a URL (e.g. `socks5://127.0.0.1:1234`), use it as `HTTPS_PROXY=<url> HTTP_PROXY=<url>` in ALL python3 commands. If empty, omit proxy. NEVER ask the user about proxy — it's in the config.
NOTE: if using socks5 protocol, convert to socks5h for python scripts, e.g. `socks5://127.0.0.1:1234` becomes `socks5h://127.0.0.1:1234`

Once valid + proxy detected, go straight to executing the user's request.

---

## Authentication

This skill uses **cookie-based authentication** for access to Zhihu. Use `sig run` to inject the session cookie:

```bash
sig run zhihu -- bash -c 'python3 scripts/zhihu_hot.py --cookie "$SIG_ZHIHU_COOKIE"'
```

The default Signet provider is `zhihu`. The env var is `SIG_ZHIHU_COOKIE`.

**All operations require authentication** — Zhihu's API enforces cookie-based auth on all endpoints.

If a script returns 401 or auth error, re-authenticate:

```bash
sig login https://www.zhihu.com/
```

Then retry the `sig run` command.

**Signet provider config:**

```yaml
zhihu:
    domains: [www.zhihu.com, zhihu.com]
    entryUrl: https://www.zhihu.com/signin
    strategy: browser
    ttl: '7d'
    required: [session.z_c0]
    extract:
        - from: cookies
          as: session
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${session}'
```

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script              | Purpose                        | Auth     |
| ------------------- | ------------------------------ | -------- |
| `zhihu_hot.py`      | Hot list (知乎热榜)            | Required |
| `zhihu_question.py` | Question answers + info        | Required |
| `zhihu_answer.py`   | Single answer detail           | Required |
| `zhihu_search.py`   | Search questions/topics/people | Required |
| `zhihu_member.py`   | User profile + answers         | Required |
| `zhihu_topic.py`    | Search topics by keyword       | Required |

### zhihu_hot.py

```
--cookie COOKIE       Zhihu session cookie (required)
--limit N             Max items (default: 50)
```

### zhihu_question.py

```
--cookie COOKIE       Zhihu session cookie (required)
--id ID               Question ID (required)
--answers-limit N     Max answers to fetch (default: 10)
--sort SORT           Sort answers: "default" or "created" (default: "default")
```

Note: Question title and ID are extracted from the answers endpoint since Zhihu's question detail API is protected by anti-crawler measures.

### zhihu_answer.py

```
--cookie COOKIE       Zhihu session cookie (required)
--id ID               Answer ID (required)
```

### zhihu_search.py

```
--cookie COOKIE       Zhihu session cookie (required)
--query TEXT          Search query (required)
--type TYPE           Search type: "general", "topic", or "people" (default: "general")
--limit N             Max results (default: 20)
```

### zhihu_member.py

```
--cookie COOKIE       Zhihu session cookie (required)
--url-token NAME      Member URL token (required)
--include-answers     Also fetch member's recent answers (flag)
```

### zhihu_topic.py

```
--cookie COOKIE       Zhihu session cookie (required)
--query TEXT          Topic search query (required)
--limit N             Max results (default: 10)
```

Note: Direct topic detail API is protected by anti-crawler. This script searches topics by keyword instead.

## Key Concepts

**Questions** — The core unit on Zhihu. Each question has a title, detail, and a list of answers. Found in URLs like `zhihu.com/question/12345`. Get from hot list or search results, then use with `zhihu_question.py`.

**Answers** — Responses to questions, ranked by votes. Each answer has content, vote count, and author info. Use `zhihu_answer.py` to fetch a single answer by ID.

**Hot List (知乎热榜)** — Zhihu's trending questions, ranked by heat score. Use `zhihu_hot.py` to browse.

**Topics** — Zhihu organizes content into topics (like tags). Examples: AI, programming, science. Use `zhihu_topic.py` to search topics by keyword.

**Members** — User profiles identified by `url_token` (found in URLs like `zhihu.com/people/zhang-san`). Use `zhihu_member.py` to view profile and answers.

**Search** — Zhihu supports searching across questions, topics, and people. Use `zhihu_search.py` with the `--type` flag to filter.

## Error Handling

| Error            | Cause                       | Fix                             |
| ---------------- | --------------------------- | ------------------------------- |
| 401 Unauthorized | Session expired / no cookie | Re-authenticate via `sig login` |
| 403 Forbidden    | Anti-crawler or rate limit  | Wait and retry, or check cookie |
| 404 Not Found    | Invalid ID                  | Check question/answer ID        |
| `RATE_LIMITED`   | Too many requests           | Wait and retry                  |

## Workflow Examples

### Browse hot questions

1. `sig run zhihu -- bash -c 'python3 scripts/zhihu_hot.py --cookie "$SIG_ZHIHU_COOKIE" --limit 10'`

### Read a question and its answers

1. `sig run zhihu -- bash -c 'python3 scripts/zhihu_question.py --cookie "$SIG_ZHIHU_COOKIE" --id 20010554 --answers-limit 5'`

### Search for content

1. `sig run zhihu -- bash -c 'python3 scripts/zhihu_search.py --cookie "$SIG_ZHIHU_COOKIE" --query "machine learning" --type general --limit 10'`

### View a user profile

1. `sig run zhihu -- bash -c 'python3 scripts/zhihu_member.py --cookie "$SIG_ZHIHU_COOKIE" --url-token zhang-san --include-answers'`

### Search topics

1. `sig run zhihu -- bash -c 'python3 scripts/zhihu_topic.py --cookie "$SIG_ZHIHU_COOKIE" --query "Python" --limit 5'`
