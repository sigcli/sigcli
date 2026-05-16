# Sigcli

**Sign in your way. AI works on your behalf.**

<p align="center">
  <img src="website/public/demo.gif" alt="sig demo" width="720" />
</p>

AI agents need access to your work systems — Jira, wikis, calendars, internal APIs. But passing credentials through shell history, environment variables, and agent context windows is a security nightmare.

**sig** handles browser SSO, encrypts credentials at rest, and injects them into any process — so your agents authenticate without ever seeing secrets.

```bash
npm install -g @sigcli/cli
```

## Quick Start

```bash
sig init                              # create ~/.sig/config.yaml
sig login https://jira.example.com    # authenticate via browser SSO — once

# now your AI agent can work on your behalf:
sig request https://jira.example.com/rest/api/2/myself
sig request https://jira.example.com/rest/api/2/search --method POST --body '{"jql":"assignee=currentUser()"}'
```

## OAuth2 / API Tokens

For APIs that use OAuth2 Client Credentials (no browser needed):

```bash
sig login https://oauth-mock.mock.beeceptor.com \
  --strategy oauth2 \
  --token-url https://oauth-mock.mock.beeceptor.com/oauth/token/google \
  --client-id test-client \
  --client-secret test-secret
```

This mock server accepts any client_id/secret and returns a JWT token. After setup:

```bash
sig status oauth-mock                # check token status
sig get oauth-mock --no-redaction    # see raw Bearer token
sig logout oauth-mock                # clear token (keeps secrets)
sig get oauth-mock                   # auto-refreshes using stored credentials
```

Configure once, then all commands work the same as browser-based providers — `sig get`, `sig run`, `sig proxy` all inject the Bearer token automatically.

## Why sig

- **Browser SSO** — signs in through a real browser. Works with any website, any login flow.
- **OAuth2 Client Credentials** — configure once, sig manages token exchange, expiry, and silent refresh. No browser needed.
- **Encrypted at rest** — AES-256-GCM encryption. Every access is audit-logged.
- **Declarative config** — define what to extract (cookies, localStorage, tokens) and how to apply them to requests.
- **Multi-provider** — inject credentials from multiple systems in a single command.
- **MITM proxy** — agents set `HTTP_PROXY` and credentials are injected transparently. Zero-trust.
- **AI-native** — stable CLI with predictable exit codes and JSON output. Built for agents.

## How It Works

```
You log in once               sig extracts & encrypts           AI agent operates
in your browser         -->   credentials locally          -->  on your behalf
(any SSO/login flow)          (~/.sig/credentials/)             (sig request / sig proxy)
```

**sig login** opens a browser, you log in normally (SSO, MFA, anything). sig extracts credentials based on `extract[]` rules, validates them against `validateUrl` (or detects login redirects), encrypts with AES-256-GCM, and stores locally. When your agent needs a request, `apply[]` rules inject credentials into HTTP headers, body, or query params.

## Provider Configuration

sig uses a progressive approach — start simple, add config only if needed:

```
Step 1: sig login <url>           ← works for 80% of sites (SSO, enterprise)
Step 2: add validateUrl           ← needed for public sites with tracking cookies
Step 3: add validateRule          ← needed for non-standard login detection
```

### Step 1: Just Login (auto-provision)

For most sites, just run:

```bash
sig login https://jira.example.com
sig status                            # ✓ jira-example: valid (expires in 2h)
```

That's it. sig opens a browser, you log in, and it auto-creates config + captures credentials. Verify with `sig status` — if it shows **valid**, you're done.

<details>
<summary>What sig auto-generates</summary>

```yaml
# ~/.sig/config.yaml (auto-generated)
jira-example:
    domains: [jira.example.com]
    entryUrl: https://jira.example.com/
    strategy: browser
    extract:
        - { from: cookies, as: cookie, match: '*' }
    apply:
        - { in: header, name: Cookie, value: '${cookie}' }
```

</details>

**When to move to Step 2:** `sig status` shows "expired" or "invalid" right after login, or `sig request <url>` returns 401/403.

### Step 2: Add `validateUrl`

Public sites (Reddit, X, LinkedIn…) set tracking cookies to **all visitors** — even before login. sig can't distinguish auth cookies from junk using redirect detection alone.

**Fix:** Add `validateUrl` — a protected endpoint that returns 401/403 when not logged in:

```yaml
reddit:
    domains: [www.reddit.com, reddit.com]
    entryUrl: https://www.reddit.com/
    validateUrl: https://www.reddit.com/prefs/friends # ← returns 403 if not logged in
    strategy: browser
    extract:
        - { from: cookies, as: cookie, match: '*' }
    apply:
        - { in: header, name: Cookie, value: '${cookie}' }
```

Then re-login and verify:

```bash
sig login reddit --force              # re-authenticate with new config
sig status reddit                     # ✓ reddit: valid
```

**How to find a validateUrl:** Open DevTools → Network tab → find any API endpoint that returns 401/403 when you're logged out. Common patterns:

| Site        | validateUrl                                            |
| ----------- | ------------------------------------------------------ |
| Reddit      | `https://www.reddit.com/prefs/friends`                 |
| X (Twitter) | `https://x.com/i/api/2/notifications/all.json?count=1` |
| LinkedIn    | `https://www.linkedin.com/voyager/api/me`              |
| YouTube     | `https://www.youtube.com/account`                      |
| V2EX        | `https://www.v2ex.com/notifications`                   |
| Zhihu       | `https://www.zhihu.com/api/v4/me`                      |

**When to move to Step 3:** `sig status` still shows invalid even with a validateUrl — the endpoint returns 200/3xx regardless of auth state.

### Step 3: Add `validateRule`

Some sites always return 200 (SPAs with client-side auth) or use non-standard signals. Use `validateRule` — a JS expression evaluated against the HTTP response:

```yaml
internal-app:
    domains: [app.example.com]
    entryUrl: https://app.example.com/
    validateUrl: https://app.example.com/api/me
    validateRule: 'res.status === 200 && res.body.authenticated === true'
    strategy: browser
    extract:
        - { from: cookies, as: cookie, match: '*' }
    apply:
        - { in: header, name: Cookie, value: '${cookie}' }
```

The `res` object has: `{ status, body, headers }`. Body is auto-parsed as JSON if possible.

**More examples:**

```yaml
# Check a specific header
validateRule: 'res.headers["x-user-id"] !== undefined'

# Check response body contains username
validateRule: 'res.status === 200 && res.body.user != null'

# Reject redirect responses (SPA that 302s to /login)
validateRule: 'res.status === 200'
```

### Decision Flowchart

```
sig login <url> → sig status
       │
       ├─ ✓ valid → Done! Use sig request / sig run / sig proxy
       │
       └─ ✗ invalid/expired immediately after login
              │
              ├─ Is it a public site? → Add validateUrl (Step 2)
              │         │
              │         ├─ ✓ valid → Done!
              │         └─ ✗ still invalid → Add validateRule (Step 3)
              │
              └─ Is it an SSO site? → Try: sig login <url> --mode visible
```

### Advanced: localStorage & Multiple Domains

<details>
<summary>localStorage extraction</summary>

Some apps store tokens in localStorage instead of cookies:

```yaml
app-slack:
    domains: [your-org.enterprise.slack.com]
    entryUrl: https://app.slack.com/client/YOUR_TEAM_ID
    strategy: browser
    extract:
        - { from: cookies, as: session, match: '*' }
        - {
              from: localStorage,
              as: xoxc-token,
              match: localConfig_v2,
              jsonPath: 'teams.YOUR_TEAM_ID.token',
          }
    apply:
        - { in: header, name: Cookie, value: '${session}' }
        - { in: header, name: Authorization, value: 'Bearer ${xoxc-token}' }
```

</details>

<details>
<summary>Multiple domains</summary>

Sites that use multiple domains (e.g. x.com + twitter.com):

```yaml
x:
    domains: [x.com, twitter.com]
    entryUrl: https://x.com/
    validateUrl: https://x.com/i/api/2/notifications/all.json?count=1
    strategy: browser
    extract:
        - { from: cookies, as: cookie, match: '*' }
        - { from: cookies, as: ct0, match: ct0 }
    apply:
        - { in: header, name: Cookie, value: '${cookie}' }
        - { in: header, name: x-csrf-token, value: '${ct0}' }
        - {
              in: header,
              name: authorization,
              value: 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
          }
```

</details>

Full guide at **[sigcli.ai](https://sigcli.ai)**.

## AI Agent Skills

Pre-built Python scripts that let AI agents operate 14+ web services — email, chat, forums, video platforms, social networks, and more. Each skill includes scripts + documentation that agents read and execute autonomously.

<p align="center">
  <img src="pitch/x-demo.gif" alt="X (Twitter) skill: search and reply from your terminal" width="720" />
</p>

Install skills to your coding agent (Claude Code, Cursor, Windsurf, Cline):

```bash
npx @sigcli/skills            # install skills to your coding agent
```

See the [full skills catalog](skills/README.md) for details.

## Documentation

Full docs, configuration, SDK, and AI agent integration guide at **[sigcli.ai](https://sigcli.ai)**.

## License

[MIT](LICENSE)
