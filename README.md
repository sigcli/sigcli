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

## Why sig

- **Browser SSO** — signs in through a real browser. Works with any website, any login flow.
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

### 2. Public sites (`validateUrl`)

Public sites set tracking cookies to **all visitors**. sig can't tell auth cookies from junk using redirect detection alone. Add `validateUrl` pointing to a protected endpoint — sig probes it and accepts credentials only on 2xx:

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
| V2EX        | `https://www.v2ex.com/settings`                        |
| Zhihu       | `https://www.zhihu.com/api/v4/me`                      |

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
