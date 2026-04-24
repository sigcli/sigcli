---
name: zhihu
description: 'Interact with Zhihu (zhihu.com) — browse hot questions, read answers, search content, view topics, check user profiles and notifications. Use this skill whenever the user mentions Zhihu, 知乎, zhihu.com, wants to browse Chinese Q&A content, read Zhihu answers, search Zhihu questions, check Zhihu hot list, or look up Zhihu users/topics. Also trigger when the user pastes a Zhihu URL (e.g. zhihu.com/question/12345), mentions a Zhihu topic, or asks about Chinese knowledge sharing platforms.'
---

# Zhihu

Browse, search, read, and interact with Zhihu — China's largest Q&A platform.

## Authentication

This skill uses **cookie-based authentication** for full access to Zhihu. Use `sig run` to inject the session cookie:

```bash
sig run zhihu -- bash -c 'python3 scripts/zhihu_hot.py --cookie "$SIG_ZHIHU_COOKIE"'
```

The default Signet provider is `zhihu`. The env var is `SIG_ZHIHU_COOKIE`.

**Most operations** (hot list, question detail, answers, search, member profile, topic info) work **without authentication** via the public Zhihu API v4. The `--cookie` argument is optional for these scripts.

If a script returns 401 or auth error, re-authenticate:

```bash
sig login https://www.zhihu.com/
```

Then retry the `sig run` command.

**Signet provider config:**

```yaml
zhihu:
    domains: ['www.zhihu.com', 'zhihu.com']
    entryUrl: https://www.zhihu.com/signin
    strategy: cookie
```

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script              | Purpose                        | Auth     |
| ------------------- | ------------------------------ | -------- |
| `zhihu_hot.py`      | Hot list (知乎热榜)            | Optional |
| `zhihu_question.py` | Question detail + answers      | Optional |
| `zhihu_answer.py`   | Single answer detail           | Optional |
| `zhihu_search.py`   | Search questions/topics/people | Optional |
| `zhihu_member.py`   | User profile + answers         | Optional |
| `zhihu_topic.py`    | Topic detail + best content    | Optional |

### zhihu_hot.py

```
--cookie COOKIE       Zhihu session cookie (optional)
--limit N             Max items (default: 50)
```

### zhihu_question.py

```
--cookie COOKIE       Zhihu session cookie (optional)
--id ID               Question ID (required)
--answers-limit N     Max answers to fetch (default: 10)
--sort SORT           Sort answers: "default" or "created" (default: "default")
```

### zhihu_answer.py

```
--cookie COOKIE       Zhihu session cookie (optional)
--id ID               Answer ID (required)
```

### zhihu_search.py

```
--cookie COOKIE       Zhihu session cookie (optional)
--query TEXT          Search query (required)
--type TYPE           Search type: "general", "topic", or "people" (default: "general")
--limit N             Max results (default: 20)
```

### zhihu_member.py

```
--cookie COOKIE       Zhihu session cookie (optional)
--url-token NAME      Member URL token (required)
--include-answers     Also fetch member's recent answers (flag)
```

### zhihu_topic.py

```
--cookie COOKIE       Zhihu session cookie (optional)
--id ID               Topic ID (required)
--include-essence     Also fetch topic best content (flag)
--limit N             Max essence items (default: 10)
```

## Key Concepts

**Questions** — The core unit on Zhihu. Each question has a title, detail, and a list of answers. Found in URLs like `zhihu.com/question/12345`. Get from hot list or search results, then use with `zhihu_question.py`.

**Answers** — Responses to questions, ranked by votes. Each answer has content, vote count, and author info. Use `zhihu_answer.py` to fetch a single answer by ID.

**Hot List (知乎热榜)** — Zhihu's trending questions, ranked by heat score. Use `zhihu_hot.py` to browse.

**Topics** — Zhihu organizes content into topics (like tags). Examples: AI, programming, science. Use `zhihu_topic.py` to view topic info and best content.

**Members** — User profiles identified by `url_token` (found in URLs like `zhihu.com/people/zhang-san`). Use `zhihu_member.py` to view profile and answers.

**Search** — Zhihu supports searching across questions, topics, and people. Use `zhihu_search.py` with the `--type` flag to filter.

## Error Handling

| Error            | Cause                       | Fix                             |
| ---------------- | --------------------------- | ------------------------------- |
| 401 Unauthorized | Session expired / no cookie | Re-authenticate via `sig login` |
| 403 Forbidden    | Rate limited or blocked     | Wait and retry                  |
| 404 Not Found    | Invalid ID                  | Check question/answer/topic ID  |
| `RATE_LIMITED`   | Too many requests           | Wait and retry                  |

## Workflow Examples

### Browse hot questions

1. `python3 scripts/zhihu_hot.py`

### Read a question and its answers

1. `python3 scripts/zhihu_question.py --id 12345 --answers-limit 5`

### Search for content

1. `python3 scripts/zhihu_search.py --query "machine learning" --type general --limit 10`

### View a user profile

1. `python3 scripts/zhihu_member.py --url-token zhang-san --include-answers`

### View a topic

1. `python3 scripts/zhihu_topic.py --id 19550517 --include-essence --limit 5`
