---
name: sigcli
description: Guide Claude to use SigCLI correctly — check auth, login, get credentials, configure providers, and onboard new websites. Trigger when using sig commands, editing ~/.sig/config.yaml, or needing authenticated API access.
---

# SigCLI

Reference for using SigCLI correctly. Prevents common mistakes like inventing flags, using redacted output, or misconfiguring providers.

## Constraints

These are the most common mistakes. Read them FIRST.

1. **`sig get` MUST use `--no-redaction` to get usable values.** Without it, output is `****`. This is the #1 mistake.
2. **Never invent commands.** The ONLY commands are: `init`, `doctor`, `login`, `logout`, `get`, `request`, `status`, `providers`, `rename`, `remove`, `remote`, `sync`, `watch`, `proxy`, `run`, `completion`.
3. **Never invent flags.** See Command Reference below for exact flags per command.
4. **Never invent config fields.** There is NO `requiredCookies`, `loginUrl`, `cookies`, `headers`, `authUrl`, `token`, `credentials`, or `session` field. See Provider Config Schema for the exact list.
5. **`sig login` two forms:**
    - `sig login <provider>` — provider already configured in config.yaml
    - `sig login https://example.com` — auto-provision (creates provider automatically). Use `--as` for a meaningful name: `sig login https://example.com --as example`
6. **`sig run` output is redacted.** It injects `SIG_<PROVIDER>_<KEY>` env vars into the child process, but redacts them in stdout. Use `env | grep SIG_` inside the child to discover var names.
7. **`sig get --format` only accepts:** `json`, `header`, `value`. Not `cookie-jar`, `env`, `raw`, etc.
8. **Provider config `extract` and `apply` are ARRAYS** (list of objects), not single objects.
9. **Don't modify existing provider configs** unless explicitly asked by the user.

## Command Reference

| Command      | Usage                                  | Key Flags                                                                                                                                       |
| ------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`       | `sig init`                             | `--remote`, `--yes`, `--force`                                                                                                                  |
| `doctor`     | `sig doctor`                           | —                                                                                                                                               |
| `login`      | `sig login <provider>`                 | `--strategy oauth2`, `--token-url`, `--client-id`, `--client-secret`, `--scope`, `--force`, `--mode auto\|headless\|visible`, `--network-proxy` |
| `logout`     | `sig logout [provider]`                | —                                                                                                                                               |
| `get`        | `sig get <provider>`                   | `--format json\|header\|value`, `--no-redaction`                                                                                                |
| `request`    | `sig request <url>`                    | `--method`, `--body`, `--header "K: V"`, `--format json\|body\|headers`                                                                         |
| `status`     | `sig status [provider]`                | `--format json\|yaml\|table\|plain`                                                                                                             |
| `providers`  | `sig providers`                        | `--format json\|yaml\|table\|plain`                                                                                                             |
| `rename`     | `sig rename <old> <new>`               | —                                                                                                                                               |
| `remove`     | `sig remove <provider>`                | `--keep-config`, `--force`                                                                                                                      |
| `remote`     | `sig remote add\|remove\|list`         | **add:** `<name> <host>` `--user`, `--path`, `--ssh-key`                                                                                        |
| `sync`       | `sig sync push\|pull [remote]`         | `--provider`, `--force`                                                                                                                         |
| `watch`      | `sig watch add\|remove\|set-interval`  | **add:** `<provider>` `--auto-sync`                                                                                                             |
| `proxy`      | `sig proxy start\|stop\|status\|trust` | **start:** `--port`                                                                                                                             |
| `run`        | `sig run [providers...] -- <cmd>`      | `--expand-cookies`, `--mount <path>`, `--mount-format env\|json`                                                                                |
| `completion` | `sig completion <shell>`               | bash, zsh, fish                                                                                                                                 |

Global: `--verbose`, `--help`

## Common Patterns

### Check if auth is valid

```bash
sig status <provider>
# Look for "valid": true in JSON output
```

### Get credentials for use

```bash
# JSON with headers (most common)
sig get <provider> --no-redaction

# Just the cookie/token string
sig get <provider> --no-redaction --format value

# Inject into another command
sig run <provider> -- <command>
```

### Login when expired

```bash
sig login <provider>                 # auto mode (headless first, then visible)
sig login <provider> --mode visible  # force open browser — USE THIS for first-time public site login
```

Note: Do NOT use `--force` unless you specifically want to discard existing credentials and re-authenticate from scratch. Without `--force`, `sig login` reuses existing valid credentials if available.

### Make an authenticated request

```bash
sig request https://api.example.com/endpoint --method GET
```

## Onboarding a New Provider

When the user wants to authenticate to a new website, follow these steps:

### Step 1: Try auto-provision first

```bash
sig login https://example.com --as my-site
```

This auto-provisions a basic config (domains, entryUrl, extract all cookies, apply as Cookie header).

**If it works** (you get a chance to log in, `sig status my-site` shows `valid: true`) → done.

**If the browser closes immediately without letting you log in** — this happens on public sites (Weibo, Reddit, X, Bilibili) where the homepage returns 200 without auth. sigcli thinks it's already authenticated because there's no redirect.

**Fix:** Add a `validateUrl` to the auto-provisioned config. Don't rewrite the config — just add the one field:

```bash
# Check what was auto-provisioned
grep -A15 "my-site:" ~/.sig/config.yaml
```

Edit `~/.sig/config.yaml` and add a `validateUrl` under the provider — a URL that redirects or returns 401 when not logged in:

```yaml
  my-site:
    domains:
      - example.com
    entryUrl: https://example.com/
    validateUrl: https://example.com/notifications  # ADD THIS
    strategy: browser
    ...
```

Then login again:

```bash
sig login my-site
```

Now sigcli keeps the browser open until validateUrl confirms you're authenticated.

Verify after login:

```bash
sig status my-site              # should show valid: true
sig request <validateUrl>       # should return authenticated response (not redirect/401)
```

### Step 2: Figure out validateUrl or validateRule

**validateUrl** — an endpoint that returns non-2xx (or redirects) when NOT logged in:

- Check if the site has `/api/me`, `/api/user`, `/notifications`, `/rest/auth/1/session`
- The URL must return 2xx ONLY when authenticated

```yaml
validateUrl: https://example.com/api/me
```

**validateRule** — when the endpoint always returns 200 but body differs:

- Use a JS expression that evaluates to truthy when authenticated
- Available variables in the sandbox:
    - `res.status` — HTTP status code (number)
    - `res.body` — parsed JSON (if response is valid JSON) or raw string
    - `res.headers` — object (e.g. `{ location: "..." }`)
- The expression is wrapped in `(...)` and evaluated — must return truthy for "authenticated"
- Common pitfall: `res.body && res.body.name` fails because empty objects `{}` are truthy. Be specific about what field proves authentication.

```yaml
validateUrl: https://example.com/api/me
validateRule: 'res.body.name !== undefined'
```

More examples:

```yaml
# Douyin: API returns {status_code: 0} when authenticated
validateRule: "res.body.status_code === 0"

# Site returns {logged_in: true/false}
validateRule: "res.body.logged_in === true"

# Reddit /api/me.json: returns {} when not logged in, {name: "user"} when logged in
validateRule: "typeof res.body.name === 'string'"
```

**How to discover validateUrl and validateRule:**

**Prerequisites:** You should know at least one authenticated API endpoint of the target site (e.g. from docs, DevTools network tab, or common patterns).

**Step 1: Login first (auto-provision handles basics)**

```bash
sig login https://new-website.com --as new-site
```

**Step 2: Verify with a known API**

```bash
sig request https://new-website.com/my/api
```

If this works (returns authenticated data), you have a good `validateUrl` candidate. Add it to the config.

**Step 3: If `sig request` fails, find a suitable validateUrl**

A good validateUrl must be:

- **GET** method (validation only does GET)
- **Callable with just the `apply` rules** — sigcli builds the request using your `extract` + `apply` config. If the API needs headers beyond Cookie (e.g. CSRF token), those must be in your `extract`/`apply` rules too.
- **Distinguishes authenticated from unauthenticated** — the validation logic is:

How sigcli decides "authenticated" (in order):

1. If `validateRule` exists → evaluate it (overrides everything below)
2. Status 401/403/406/429 → **invalid**
3. Status 3xx (redirect):
    - With explicit `validateUrl` → **any redirect = invalid** (strict)
    - Without `validateUrl` (entryUrl fallback) → only invalid if redirect goes to `/login`, `/signin`, `/auth`, `/sso`
4. Body < 4KB with JS redirect (`window.location=`, `<meta http-equiv="refresh">`) → **invalid**
5. Otherwise → **valid**

**Best validateUrl candidates** (in order of preference):

1. A page that **redirects to login** when unauthenticated — e.g. `/notifications`, `/settings`, `/account`, `/prefs/friends`. This is the cleanest: any 3xx = invalid.
2. An API that **returns 401/403** when unauthenticated — e.g. `/api/me`, `/api/v4/me`, `/voyager/api/me`.
3. An API that returns 200 always but **different body** — needs `validateRule` (last resort).

Common patterns that work as validateUrl:
| Pattern | Why it works |
|---------|-------------|
| `/notifications` | Redirects to login without auth (V2EX, Xiaohongshu) |
| `/account`, `/settings`, `/prefs/friends` | Redirects to login without auth (YouTube, Reddit) |
| `/api/me`, `/api/v4/me`, `/voyager/api/me` | Returns 401 without auth (Zhihu, LinkedIn) |
| `/i/api/2/notifications/all.json` | Returns 401/403 without auth (X — but needs csrf header) |

If the API needs extra headers (e.g. CSRF token), extract them:

```yaml
extract:
    - from: cookies
      as: cookie
      match: '*'
    - from: cookies
      as: csrf_token
      match: 'csrf_token_cookie_name'
apply:
    - in: header
      name: Cookie
      value: '${cookie}'
    - in: header
      name: x-csrf-token
      value: '${csrf_token}'
```

Some APIs need a hardcoded app-level token (e.g. X's public Bearer token):

```yaml
apply:
    - in: header
      name: authorization
      value: 'Bearer AAAAAA...' # hardcoded public app token
```

**Step 4: If validateUrl always returns 200 (rare), add validateRule**

This only happens when the endpoint returns 200 for both authenticated and unauthenticated but with different body content. Compare:

```bash
# With auth
sig request https://new-website.com/api/check

# Without auth (raw curl)
curl https://new-website.com/api/check
```

Write a rule based on the difference. The rule sandbox has:

- `res.status` — HTTP status (number)
- `res.body` — auto-parsed JSON if valid, otherwise raw string
- `res.headers` — response headers object

```yaml
# Douyin: returns {status_code: 0} when authenticated, {status_code: -1} otherwise
validateRule: "res.body.status_code === 0"

# Reddit /api/me.json: returns {} when not logged in, {name: "user"} when logged in
validateRule: "typeof res.body.name === 'string'"
```

Common pitfall: `res.body && res.body.name` — empty objects `{}` are truthy! Always check a specific field value.

### Step 3: Handle special extraction

**Extract specific cookies** (when you need individual values):

```yaml
extract:
    - from: cookies
      as: cookie
      match: '*' # full cookie string
    - from: cookies
      as: csrf_token
      match: 'csrf_token' # single cookie by name
```

**Extract from localStorage** (for SPA tokens):

```yaml
extract:
    - from: localStorage
      as: access_token
      match: 'auth_key_pattern'
      jsonPath: token # if the value is JSON, extract a field
```

### Step 4: Test

```bash
sig login my-provider          # opens browser, log in
sig status my-provider         # should show valid: true
sig get my-provider --no-redaction  # should show actual credentials
```

If `sig status` shows `valid: false` after login:

- The `validateUrl` is wrong (try a different endpoint)
- Or add `validateRule` if the endpoint returns 200 regardless

Debug with: `sig login my-provider --mode visible --verbose`

## Provider Config Schema

### Valid top-level fields for a provider

```yaml
my-provider:
    name: 'Display Name' # optional
    domains: [example.com] # required: list of domains
    entryUrl: https://example.com/ # required for browser/prompt; optional for oauth2
    strategy: browser # required: browser | prompt | oauth2
    ttl: 2h # optional: credential lifetime
    validateUrl: https://... # optional: URL to check auth (must 401/403 when unauthenticated)
    validateRule: 'res.body.ok' # optional: JS expression when validateUrl returns 200 regardless
    networkProxy: socks5://... # optional: proxy for this provider
    loginMode: visible # optional: auto | headless | visible
    loginUrlPatterns: [/login, /auth] # optional: URL substrings to detect login pages
    extract: [...] # required for browser/prompt: what to capture
    apply: [...] # required: how to use captured values
    oauth2: # only for strategy: oauth2
        tokenUrl: https://...
        scopes: ['scope1', 'scope2']
```

Note: `headlessTimeout` and `visibleTimeout` are browser-level settings (under `browser:` in config root), NOT provider-level.

### Fields that DO NOT EXIST (never use these)

`required`, `cookiePaths`, `requiredCookies`, `cookies`, `headers`, `loginUrl`, `authUrl`, `token`, `credentials`, `session`, `headlessTimeout`, `visibleTimeout`, `waitUntil`

## Troubleshooting

| Symptom                       | Cause                        | Fix                                         |
| ----------------------------- | ---------------------------- | ------------------------------------------- |
| `sig get` returns `****`      | Missing `--no-redaction`     | Add `--no-redaction` flag                   |
| `valid: false` after login    | Wrong/missing validateUrl    | Find an API endpoint that 401s without auth |
| `configured: false`           | Provider not in config.yaml  | Add provider config first, then login       |
| Browser opens but login fails | Site needs visible mode      | Use `--mode visible`                        |
| `sig run` env vars empty      | Provider credentials expired | Run `sig login <provider>` first            |
| `command not found: sig`      | Not installed globally       | `npm install -g @sigcli/cli`                |

## Self-Test

```bash
# 1. sig is installed
sig --help 2>&1 | head -1
# Expected: "sig — authenticate once, use everywhere"

# 2. Config exists
cat ~/.sig/config.yaml | head -3
# Expected: "version: 2" or similar

# 3. Check a provider status
sig status 2>&1 | head -5
```
