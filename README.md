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

### Config Example

```yaml
providers:
    my-jira:
        domains: [jira.example.com]
        entryUrl: https://jira.example.com/
        strategy: browser
        extract:
            - { from: cookies, name: session, key: '*' }
        apply:
            - { in: header, name: Cookie, value: '${session}' }
```

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
