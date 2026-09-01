# Sigcli

**Sign in your way. AI works on your behalf.**

<p align="center">
  <img src="website/public/demo-v2.gif" alt="sig demo" width="720" />
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

**sig login** opens a browser, you log in normally (SSO, MFA, anything). sig extracts credentials based on `extract[]` rules, validates them against `validateUrl` or `validateRule` (or detects login redirects), encrypts with AES-256-GCM, and stores locally. When your agent needs a request, `apply[]` rules inject credentials into HTTP headers, body, or query params.

## Provider Configuration

Most enterprise/SSO sites work with zero config. Public sites need a bit more. Here's the progression from simple to advanced:

### 1. Zero config (auto-provision)

For SSO-protected internal tools, just run:

```bash
sig login https://jira.example.com
```

sig opens a real browser, you log in, and it writes config automatically:

```yaml
# ~/.sig/config.yaml (auto-generated)
jira-example:
    domains:
        - jira.example.com
    entryUrl: https://jira.example.com/
    strategy: browser
    extract:
        - from: cookies
          as: session
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${session}'
```

### 2. Public sites (`validateUrl` + `validateRule`)

Public sites set tracking cookies to **all visitors**. sig can't tell auth cookies from junk using redirect detection alone. Use `validateUrl`, `validateRule`, or both:

**`validateUrl`** — point to a protected endpoint. sig probes it and accepts credentials only on 2xx:

```yaml
reddit:
    domains:
        - www.reddit.com
        - reddit.com
    entryUrl: https://www.reddit.com/
    validateUrl: https://www.reddit.com/prefs/friends
    strategy: browser
    extract:
        - from: cookies
          as: cookie
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
```

sig validates extracted credentials against `validateUrl` — 401/403 means not logged in, 2xx means success.

| Site        | validateUrl                                            |
| ----------- | ------------------------------------------------------ |
| Reddit      | `https://www.reddit.com/prefs/friends`                 |
| X (Twitter) | `https://x.com/i/api/2/notifications/all.json?count=1` |
| LinkedIn    | `https://www.linkedin.com/voyager/api/me`              |
| YouTube     | `https://www.youtube.com/account`                      |
| V2EX        | `https://www.v2ex.com/notifications`                   |
| Zhihu       | `https://www.zhihu.com/api/v4/me`                      |

**`validateRule`** — a JS expression for APIs that return 200 even when unauthenticated (e.g. with an error code in the JSON body). Use alone or together with `validateUrl`:

```yaml
douyin:
    domains:
        - www.douyin.com
    entryUrl: https://www.douyin.com
    validateUrl: https://www.douyin.com/aweme/v1/web/notice/count/
    validateRule: 'res.body.status_code === 0'
    strategy: browser
    extract:
        - from: cookies
          as: cookie
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
```

`validateRule` is a JavaScript expression with access to `res` (the validation response):

| Field         | Type                     | Description                                  |
| ------------- | ------------------------ | -------------------------------------------- |
| `res.status`  | `number`                 | HTTP status code                             |
| `res.body`    | `object \| string`       | Parsed JSON body (or raw string if not JSON) |
| `res.headers` | `Record<string, string>` | Response headers                             |

The expression must return a truthy value for credentials to be accepted. Examples:

```yaml
# API returns { "status_code": 0 } on success
validateRule: 'res.body.status_code === 0'

# API returns { "logged_in": true }
validateRule: 'res.body.logged_in === true'

# Accept any 2xx that isn't an error page
validateRule: 'res.status >= 200 && res.status < 300 && !res.body.error'
```

When `validateRule` is set, it **overrides** the built-in status-code and redirect detection logic entirely.

### 3. Multiple domains

Some sites use multiple domains (e.g. x.com migrated from twitter.com). List all domains so sig captures cookies from both:

```yaml
x:
    domains:
        - x.com
        - twitter.com
    entryUrl: https://x.com/
    validateUrl: https://x.com/i/api/2/notifications/all.json?count=1
    strategy: browser
    networkProxy: socks5://127.0.0.1:3333
    extract:
        - from: cookies
          as: cookie
          match: '*'
        - from: cookies
          as: ct0
          match: 'ct0'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
        - in: header
          name: x-csrf-token
          value: '${ct0}'
        - in: header
          name: authorization
          value: 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'
```

### 4. localStorage extraction (advanced)

Some apps store tokens in localStorage instead of cookies. Use `from: localStorage` with `match` (key pattern) and `jsonPath` (nested field):

```yaml
app-slack:
    domains:
        - your-org.enterprise.slack.com
    entryUrl: https://app.slack.com/client/YOUR_TEAM_ID
    strategy: browser
    extract:
        - from: cookies
          as: session
          match: '*'
        - from: localStorage
          as: xoxc-token
          match: localConfig_v2
          jsonPath: teams.YOUR_TEAM_ID.token
    apply:
        - in: header
          name: Cookie
          value: '${session}'
        - in: header
          name: Authorization
          value: 'Bearer ${xoxc-token}'
```

Full guide with debugging tips at **[sigcli.ai](https://sigcli.ai)**.

## Identity Providers (2FA auto-fill)

If a provider redirects through an IdP that challenges you for a 6-digit TOTP code (Authenticator-style), sig can fill and submit it for you. Configure the IdP once by hostname:

```bash
sig idp add idp.example.com --totp-secret JBSWY3DPEHPK3PXP --label corp
```

- Secret is validated (base32, ≥16 chars) and stored **encrypted** at `~/.sig/idps/<hostname>.json`. It never appears in `config.yaml`.
- The hostname is matched with a **strict suffix rule** — `idp.example.com` matches itself and `*.idp.example.com`, but NOT `evil-idp.example.com`.
- On the next `sig login <provider>`, when the browser lands on the IdP page, sig types the current code and submits the form. Non-IdP pages are untouched.

Manage IdPs:

```bash
sig idp list                             # secrets always redacted
sig idp show idp.example.com
sig idp remove idp.example.com
```

If you have many accounts, export them from your authenticator app and bulk-import:

```bash
sig idp import ~/Downloads/authenticator.txt        # one otpauth://totp/ URI per line
sig idp import ~/Downloads/authenticator.txt --force # overwrite existing entries
```

The file format is one `otpauth://totp/` URI per line (the standard export format from Google Authenticator and most other TOTP apps). The hostname is derived from the `issuer` parameter, falling back to the label prefix before `:`. Blank lines and lines not starting with `otpauth://totp/` are skipped.

### Custom selectors (when defaults don't fit)

sig's built-in list covers common OTP inputs (`#otp`, `input[name=code|passcode|otp]`, `input[autocomplete=one-time-code]`, `input[type=tel][maxlength=6]`, `input[inputmode=numeric]`). If your IdP page uses different markup — or the defaults match the wrong element (e.g. a phone-number field on the same host) — override on a per-IdP basis by hand-editing `~/.sig/config.yaml`:

```yaml
idps:
    idp.example.com:
        label: corp
        totp:
            selectors:
                input: # tried BEFORE the built-in list
                    - '#passcode-field'
                    - 'input[data-testid=otp]'
                submit: # optional; tried BEFORE form.requestSubmit()
                    - 'button.confirm'
```

Rules:

- All fields are optional. Omit `totp.selectors` entirely to use the defaults.
- User `input` selectors are tried first; the built-in list is a fallback.
- User `submit` selectors are `.click()`-ed on first visible match. If none match, sig falls back to `form.requestSubmit()`.
- Secrets are never accepted in YAML — `secret` / `totpSecret` / `totp.secret` fields (case-insensitive) are rejected by the validator. Use `sig idp add` for the secret.
- `sig idp add <existing-host>` merges into the existing entry: `--label` and hand-configured `selectors` are preserved on secret rotation.

### Debugging

Run login with `--verbose` and watch stderr:

```bash
sig login <provider> --mode visible --verbose
```

Look for `TOTP filled on <hostname> (submit=true)`. If the line is absent, the current page hostname didn't match any configured IdP. If `submit=false`, the input was filled but no form / submit selector was found — configure `totp.selectors.submit` for that IdP.

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

## Talks

- **Agentic Conf 2026** — _From Zero-Trust Proxy to Skill-Ecosystem Governance: An Engineering Practice in Agentic Harness Engineering_ — [slides (PDF)](talks/agentic-conf-2026-deck.pdf)

## Documentation

Full docs, configuration, SDK, and AI agent integration guide at **[sigcli.ai](https://sigcli.ai)**.

## Issues

Report an issue https://github.com/sigcli/sigcli/issues

Or contact me: syncviip@gmail.com

## License

[MIT](LICENSE)
