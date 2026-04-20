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
- **Multi-provider** — inject credentials from multiple systems in a single command.
- **MITM proxy** — agents set `HTTP_PROXY` and credentials are injected transparently. Zero-trust.
- **AI-native** — stable CLI with predictable exit codes and JSON output. Built for agents.

## How It Works

```
You log in once               sig stores & encrypts             AI agent operates
in your browser         -->   credentials locally          -->  on your behalf
(browser SSO)                 (~/.sig/credentials/)             (sig request / sig proxy)
```

## Documentation

Full docs, configuration, strategies, SDK, and AI agent integration guide at **[sigcli.ai](https://sigcli.ai)**.

## License

[MIT](LICENSE)
