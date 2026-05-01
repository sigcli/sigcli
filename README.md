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

**sig login** opens a real browser to the provider's entry URL. You log in normally — SSO, MFA, SAML, anything. Once authenticated, sig extracts credentials (cookies, localStorage tokens) based on your config's `extract[]` rules, encrypts them with AES-256-GCM, and stores them locally. When your agent needs to make a request, `apply[]` rules control how credentials are injected into HTTP headers, body, or query params.

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

### 2. Adding `required` cookies

Public sites set tracking cookies to **all visitors**. Without `required`, sig can't tell auth cookies from junk. Add `required` to validate:

```yaml
bilibili:
    domains:
        - www.bilibili.com
    entryUrl: https://www.bilibili.com/
    strategy: browser
    required:
        - cookie.SESSDATA
        - cookie.bili_jct
    extract:
        - from: cookies
          as: cookie
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
```

When required cookies are missing, sig falls back from headless to your real browser where you're logged in.

| Site        | Required Cookies               |
| ----------- | ------------------------------ |
| Bilibili    | `SESSDATA`, `bili_jct`         |
| Reddit      | `reddit_session`, `token_v2`   |
| X (Twitter) | `ct0`, `auth_token`            |
| YouTube     | `SAPISID`, `__Secure-3PAPISID` |
| LinkedIn    | `JSESSIONID`, `li_at`          |
| V2EX        | `A2`                           |
| Zhihu       | `z_c0`                         |

### 3. Multiple domains

Some sites use multiple domains (e.g. x.com migrated from twitter.com). List all domains so sig captures cookies from both:

```yaml
x:
    domains:
        - x.com
        - twitter.com
    entryUrl: https://x.com/
    strategy: browser
    networkProxy: socks5://127.0.0.1:3333
    required:
        - cookie.ct0
        - cookie.auth_token
    extract:
        - from: cookies
          as: cookie
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
```

### 4. localStorage extraction (advanced)

Some apps store tokens in localStorage instead of cookies. Use `from: localStorage` with `match` (key pattern) and `jsonPath` (nested field):

```yaml
app-slack:
    domains:
        - your-org.enterprise.slack.com
    entryUrl: https://app.slack.com/client/YOUR_TEAM_ID
    strategy: browser
    required:
        - session.d
        - xoxc-token
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

Install skills to your coding agent (Claude Code, Cursor, Windsurf, Cline):

```bash
npx @sigcli/skills            # install skills to your coding agent
```

See the [full skills catalog](skills/README.md) for details.

## Documentation

Full docs, configuration, SDK, and AI agent integration guide at **[sigcli.ai](https://sigcli.ai)**.

## License

[MIT](LICENSE)
