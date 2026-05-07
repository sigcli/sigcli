---
name: zhihu
description: 'Interact with Zhihu (zhihu.com) — browse hot questions, read answers, search content, view topics, check user profiles. Use this skill whenever the user mentions Zhihu, 知乎, zhihu.com, wants to browse Chinese Q&A content, read Zhihu answers, search Zhihu questions, check Zhihu hot list, or look up Zhihu users/topics. Also trigger when the user pastes a Zhihu URL (e.g. zhihu.com/question/12345), mentions a Zhihu topic, or asks about Chinese knowledge sharing platforms.'
---

# Zhihu

Browse, search, read, and interact with Zhihu — China's largest Q&A platform.

## Skill Directory

`<SKILL_DIR>` is the directory containing this SKILL.md file. Determine it ONCE at the start and reuse it.

## Setup (run FIRST — every time, before any operation)

You MUST complete this setup before running any script. Do NOT skip this step.

```bash
sig status zhihu 2>&1
```

Check the JSON output fields `configured` and `valid`:

- **`configured: false`** → run Provider Setup below. Do NOT proceed without completing it.
- **`valid: false` (but configured: true)** → run `sig login zhihu`, then re-check.
- **`valid: true`** → detect proxy (see below), then execute the user's request.

### Provider Setup

1. Read `<SKILL_DIR>/references/provider-config.yaml`
2. Append the provider block to `~/.sig/config.yaml` under `providers:`
3. Ask the user: "Do you need a proxy to access this site?" — if yes, add `networkProxy: <url>` under the provider in config.yaml
4. Run `sig login zhihu` (with `--network-proxy <url>` if proxy was specified)
5. Verify: run `sig status zhihu` again — must show `valid: true` before proceeding

### Proxy Detection (after provider is valid)

```bash
grep -A15 "^\s*zhihu:" ~/.sig/config.yaml | grep networkProxy | awk '{print $2}'
```

If this outputs a URL, prefix ALL python3 commands with `HTTPS_PROXY=<url> HTTP_PROXY=<url>`.
If using socks5, convert to socks5h for python (e.g. `socks5://...` → `socks5h://...`).
If empty, no proxy needed.

## Running Scripts

All scripts require setup to be completed first (see above).

**All operations** — use `sig run` to inject cookie (required for all Zhihu endpoints):

```bash
sig run zhihu -- bash -c 'python3 <SKILL_DIR>/scripts/zhihu_hot.py --cookie "$SIG_ZHIHU_COOKIE" --limit 10'
```

Env var: `SIG_ZHIHU_COOKIE`

**On auth error (401/403):** run `sig login zhihu` automatically (no user prompt), then retry.

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

| Error            | Cause                       | Fix                                                 |
| ---------------- | --------------------------- | --------------------------------------------------- |
| 401 Unauthorized | Session expired / no cookie | Auto-run `sig login` (no user prompt needed), retry |
| 403 Forbidden    | Anti-crawler or rate limit  | Wait and retry, or check cookie                     |
| 404 Not Found    | Invalid ID                  | Check question/answer ID                            |
| `RATE_LIMITED`   | Too many requests           | Wait and retry                                      |

## Workflow Examples

### Browse hot questions

1. `sig run zhihu -- bash -c 'python3 <SKILL_DIR>/scripts/zhihu_hot.py --cookie "$SIG_ZHIHU_COOKIE" --limit 10'`

### Read a question and its answers

1. `sig run zhihu -- bash -c 'python3 <SKILL_DIR>/scripts/zhihu_question.py --cookie "$SIG_ZHIHU_COOKIE" --id 20010554 --answers-limit 5'`

### Search for content

1. `sig run zhihu -- bash -c 'python3 <SKILL_DIR>/scripts/zhihu_search.py --cookie "$SIG_ZHIHU_COOKIE" --query "machine learning" --type general --limit 10'`

### View a user profile

1. `sig run zhihu -- bash -c 'python3 <SKILL_DIR>/scripts/zhihu_member.py --cookie "$SIG_ZHIHU_COOKIE" --url-token zhang-san --include-answers'`

### Search topics

1. `sig run zhihu -- bash -c 'python3 <SKILL_DIR>/scripts/zhihu_topic.py --cookie "$SIG_ZHIHU_COOKIE" --query "Python" --limit 5'`
