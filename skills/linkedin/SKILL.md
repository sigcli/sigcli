---
name: linkedin
description: 'Interact with LinkedIn — view your profile, browse other profiles, read the feed, search jobs/posts/people, get job details, create posts, like/unlike posts, comment, send connection requests, and follow/unfollow users. Use this skill whenever the user mentions LinkedIn, wants to search for jobs or people, read their LinkedIn feed, view a profile, get job details, create a post, like or comment on content, send a connection request, or follow someone. Also trigger when the user pastes a LinkedIn URL (e.g. linkedin.com/in/..., linkedin.com/jobs/view/...) or mentions LinkedIn networking.'
---

# LinkedIn

View profiles, browse the feed, search jobs/posts/people, get job details, create posts, like/unlike, comment, send connections, and follow/unfollow on LinkedIn.

## Authentication

**All operations** require a LinkedIn session cookie containing `JSESSIONID` and `li_at`. Use `sig run` to inject it:

```bash
sig run linkedin -- bash -c 'python3 scripts/linkedin_me.py --cookie "$SIG_LINKEDIN_COOKIE"'
```

The default Signet provider is `linkedin`. The env var is `SIG_LINKEDIN_COOKIE`.

> **Note:** If `sig login` creates the provider as `www-linkedin` (from the domain), the env var will be `SIG_WWW_LINKEDIN_COOKIE`. You can rename it: `sig rename www-linkedin linkedin`.

If a script returns auth error, re-authenticate:

```bash
sig login https://www.linkedin.com/login
```

> **Login caution:** Headless browser automation may trigger LinkedIn security challenges (CAPTCHA, phone verification, or temporary account restrictions). LinkedIn actively detects automated logins. If `sig login` fails, use the manual cookie method below.

**Manual cookie setup (recommended):**

1. Open https://www.linkedin.com/ and log in normally in Chrome
2. DevTools (F12) → Application → Cookies → `https://www.linkedin.com`
3. Find `JSESSIONID` (starts with `"ajax:..."`) and `li_at` (long session token)
4. Construct the cookie string: `JSESSIONID="ajax:xxxxx"; li_at=yyyyy`
5. Run: `sig login https://www.linkedin.com/login --cookie 'JSESSIONID="ajax:xxxxx"; li_at=yyyyy'`

**Signet provider config:**

```yaml
linkedin:
    domains: ['www.linkedin.com', 'linkedin.com']
    entryUrl: https://www.linkedin.com/login
    strategy: cookie
    config:
        ttl: '30d'
        requiredCookies: ['JSESSIONID', 'li_at']
```

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script                      | Purpose              | Auth     |
| --------------------------- | -------------------- | -------- |
| `linkedin_me.py`            | Current user profile | Required |
| `linkedin_profile.py`       | User profile by name | Required |
| `linkedin_feed.py`          | Home feed posts      | Required |
| `linkedin_search_jobs.py`   | Search job listings  | Required |
| `linkedin_search_posts.py`  | Search posts         | Required |
| `linkedin_search_people.py` | Search people        | Required |
| `linkedin_job.py`           | Job posting details  | Required |

### Write Operations

| Script                | Purpose                 | Auth     |
| --------------------- | ----------------------- | -------- |
| `linkedin_post.py`    | Create a post           | Required |
| `linkedin_like.py`    | Like/unlike a post      | Required |
| `linkedin_comment.py` | Comment on a post       | Required |
| `linkedin_connect.py` | Send connection request | Required |
| `linkedin_follow.py`  | Follow/unfollow a user  | Required |

### linkedin_me.py

```
--cookie COOKIE      LinkedIn session cookie (optional, uses SIG_LINKEDIN_COOKIE)
```

### linkedin_profile.py

```
--username TEXT       LinkedIn username or profile URL (required)
--cookie COOKIE      LinkedIn session cookie (optional)
```

### linkedin_feed.py

```
--limit N            Max posts (default: 10)
--cookie COOKIE      LinkedIn session cookie (optional)
```

### linkedin_search_jobs.py

```
--query TEXT          Job search keywords (required)
--location TEXT       Location filter (optional)
--limit N            Max results (default: 10)
--start N            Offset for pagination (default: 0)
--experience TEXT     Experience level codes (comma-sep: 1=intern,2=entry,3=assoc,4=mid,5=dir,6=exec)
--job-type TEXT       Job type codes (F=full,P=part,C=contract,T=temp,V=volunteer,I=intern)
--date-posted TEXT    Date filter (r86400=24h, r604800=week, r2592000=month)
--remote TEXT         Workplace type (1=onsite, 2=remote, 3=hybrid)
--cookie COOKIE      LinkedIn session cookie (optional)
```

### linkedin_search_posts.py

```
--query TEXT          Search keywords (required)
--limit N            Max results (default: 10)
--cookie COOKIE      LinkedIn session cookie (optional)
```

### linkedin_search_people.py

```
--query TEXT          Search keywords (required)
--limit N            Max results (default: 10)
--start N            Offset for pagination (default: 0)
--cookie COOKIE      LinkedIn session cookie (optional)
```

### linkedin_job.py

```
--id TEXT             Job ID or LinkedIn job URL (required)
--cookie COOKIE      LinkedIn session cookie (optional)
```

### linkedin_post.py

```
--cookie COOKIE      LinkedIn session cookie (required)
--text TEXT           Post text content (required)
```

### linkedin_like.py

```
--cookie COOKIE      LinkedIn session cookie (required)
--urn TEXT            Post URN, e.g. urn:li:activity:1234567890 (required)
--undo               Unlike instead of like
```

### linkedin_comment.py

```
--cookie COOKIE      LinkedIn session cookie (required)
--urn TEXT            Post URN to comment on (required)
--text TEXT           Comment text (required)
```

### linkedin_connect.py

```
--cookie COOKIE      LinkedIn session cookie (required)
--urn TEXT            Profile URN, e.g. urn:li:fsd_profile:ACoAA... (required)
--message TEXT        Custom connection message (optional)
```

### linkedin_follow.py

```
--cookie COOKIE      LinkedIn session cookie (required)
--urn TEXT            User URN, e.g. urn:li:fsd_profile:ACoAA... (required)
--undo               Unfollow instead of follow
```

## Safety

**LinkedIn is a professional network.** Actions taken here are visible to your professional contacts and can affect your reputation. Always confirm with the user before executing write operations:

- **Creating posts** — confirm the text content before publishing
- **Sending connection requests** — confirm the target person and optional message
- **Commenting on posts** — confirm the comment text before posting
- **Liking/unliking** — these are reversible (`--undo`), but still confirm first
- **Following/unfollowing** — these are reversible (`--undo`), but still confirm first

## Key Concepts

**Profile identifiers** — `linkedin_profile.py` accepts a LinkedIn username (`janedoe`), a full profile URL (`https://www.linkedin.com/in/janedoe`), or an `@`-prefixed handle. URLs are resolved automatically.

**Job identifiers** — `linkedin_job.py` accepts a numeric job ID (`12345678`) or a full LinkedIn job URL (`https://www.linkedin.com/jobs/view/12345678`). The ID is extracted automatically.

**URNs** — Write operations (like, comment, connect, follow) use LinkedIn URN identifiers. Post URNs look like `urn:li:activity:7100000000000000001`. Profile URNs look like `urn:li:fsd_profile:ACoAAA123456`. You can find these in the output of read operations.

**Voyager API** — All operations use LinkedIn's internal Voyager API (`/voyager/api/`), which is the same API the LinkedIn website uses. Authentication is via JSESSIONID CSRF token and li_at session cookie.

**Post search** — `linkedin_search_posts.py` parses RSC-embedded HTML from the search results page rather than a JSON API. Results may be less structured than other endpoints.

## Known Limitations

- **Rate limiting** — LinkedIn aggressively rate-limits API calls. The client retries once on HTTP 429 with the `Retry-After` delay, but sustained heavy usage may result in temporary blocks.
- **Search post parsing** — Post search relies on HTML scraping of RSC payloads, which may break if LinkedIn changes their frontend markup.
- **No pagination for feed** — The feed endpoint returns a single page of results up to the limit.
- **Connection requests** — Require the target's profile URN, not their username. Use `linkedin_search_people.py` or `linkedin_profile.py` to find URNs first.
- **Session expiry** — LinkedIn sessions typically last 30 days but may expire sooner if LinkedIn detects unusual activity.
- **No media uploads** — `linkedin_post.py` creates text-only posts. Image/video posts are not supported.

## Error Handling

| Error         | Cause                           | Fix                                      |
| ------------- | ------------------------------- | ---------------------------------------- |
| AUTH_REQUIRED | No cookie or missing JSESSIONID | Run `sig login` or set cookie manually   |
| AUTH_EXPIRED  | Session cookie expired (401)    | Re-authenticate via `sig login`          |
| NOT_FOUND     | Profile or resource not found   | Check the username or ID is correct      |
| HTTP_429      | Rate limited by LinkedIn        | Wait and retry; reduce request frequency |
| HTTP_403      | Forbidden or restricted         | Check account status; may need re-login  |

## Workflow Examples

### View your own profile

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_me.py --cookie "$SIG_LINKEDIN_COOKIE"'`

### Look up someone's profile

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_profile.py --cookie "$SIG_LINKEDIN_COOKIE" --username janedoe'`
2. Or with URL: `sig run linkedin -- bash -c 'python3 scripts/linkedin_profile.py --cookie "$SIG_LINKEDIN_COOKIE" --username "https://www.linkedin.com/in/janedoe"'`

### Browse your feed

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_feed.py --cookie "$SIG_LINKEDIN_COOKIE" --limit 5'`

### Search for jobs

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_search_jobs.py --cookie "$SIG_LINKEDIN_COOKIE" --query "python developer" --location "San Francisco" --limit 10'`
2. With filters: `sig run linkedin -- bash -c 'python3 scripts/linkedin_search_jobs.py --cookie "$SIG_LINKEDIN_COOKIE" --query "data engineer" --remote 2 --experience 4'`

### Search for posts

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_search_posts.py --cookie "$SIG_LINKEDIN_COOKIE" --query "machine learning" --limit 5'`

### Search for people

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_search_people.py --cookie "$SIG_LINKEDIN_COOKIE" --query "software engineer at google" --limit 10'`

### Get job details

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_job.py --cookie "$SIG_LINKEDIN_COOKIE" --id 12345678'`
2. Or with URL: `sig run linkedin -- bash -c 'python3 scripts/linkedin_job.py --cookie "$SIG_LINKEDIN_COOKIE" --id "https://www.linkedin.com/jobs/view/12345678"'`

### Create a post

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_post.py --cookie "$SIG_LINKEDIN_COOKIE" --text "Excited to share my latest project!"'`

### Like a post

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_like.py --cookie "$SIG_LINKEDIN_COOKIE" --urn "urn:li:activity:7100000000000000001"'`

### Unlike a post

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_like.py --cookie "$SIG_LINKEDIN_COOKIE" --urn "urn:li:activity:7100000000000000001" --undo'`

### Comment on a post

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_comment.py --cookie "$SIG_LINKEDIN_COOKIE" --urn "urn:li:activity:7100000000000000001" --text "Great insight!"'`

### Send a connection request

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_connect.py --cookie "$SIG_LINKEDIN_COOKIE" --urn "urn:li:fsd_profile:ACoAAA123456"'`
2. With message: `sig run linkedin -- bash -c 'python3 scripts/linkedin_connect.py --cookie "$SIG_LINKEDIN_COOKIE" --urn "urn:li:fsd_profile:ACoAAA123456" --message "Hi, I enjoyed your talk!"'`

### Follow a user

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_follow.py --cookie "$SIG_LINKEDIN_COOKIE" --urn "urn:li:fsd_profile:ACoAAA123456"'`

### Unfollow a user

1. `sig run linkedin -- bash -c 'python3 scripts/linkedin_follow.py --cookie "$SIG_LINKEDIN_COOKIE" --urn "urn:li:fsd_profile:ACoAAA123456" --undo'`
