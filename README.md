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

Most enterprise and SSO sites work with zero config — `sig login <url>` detects cookies automatically. Public sites with tracking cookies need a little more.

### Zero config (auto-provision)

For internal tools, wikis, and SSO-protected systems, just run:

```bash
sig login https://jira.example.com
```

sig opens a real browser, you log in normally, and it captures whatever session cookies are set. No config required.

### Adding `required` to validate cookies

Many public sites (social media, forums, video platforms) set tracking cookies for **all visitors** — logged in or not. Without `required`, sig can't tell auth cookies from tracking cookies and may capture a credential-less session.

Add `required` to list the cookies that must be present for the session to be considered authenticated:

```yaml
providers:
    bilibili:
        domains: [www.bilibili.com]
        entryUrl: https://www.bilibili.com/
        strategy: browser
        required: ['cookie.SESSDATA', 'cookie.bili_jct']
        extract:
            - from: cookies
              as: cookie
              match: '*'
        apply:
            - in: header
              name: Cookie
              value: '${cookie}'
```

When the `required` cookies are missing, sig falls back from headless to CDP (your real browser) where you're actually authenticated.

Common sites and their required cookies:

| Site        | Required Cookies               |
| ----------- | ------------------------------ |
| Bilibili    | `SESSDATA`, `bili_jct`         |
| Reddit      | `reddit_session`, `token_v2`   |
| X (Twitter) | `ct0`, `auth_token`            |
| YouTube     | `SAPISID`, `__Secure-3PAPISID` |
| LinkedIn    | `JSESSIONID`, `li_at`          |
| V2EX        | `A2`                           |
| Zhihu       | `z_c0`                         |
| Hacker News | `user`                         |

### localStorage extraction (advanced)

Some apps (Microsoft Teams, Slack) store tokens in localStorage instead of cookies. sig supports `from: localStorage` extraction rules for these cases. See the full guide at **[sigcli.ai](https://sigcli.ai)**.

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
