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

## AI Agent Skills

Pre-built Python scripts that let AI agents operate external systems. Each skill includes scripts + documentation — agents read the SKILL.md and know what to call.

| Skill                        | Platform       | Read                         | Write                    | Auth   |
| ---------------------------- | -------------- | ---------------------------- | ------------------------ | ------ |
| [Outlook](skills/outlook/)   | Email          | Inbox, search, folders       | Send, reply, forward     | OAuth2 |
| [MS Teams](skills/msteams/)  | Chat           | Messages, channels, calendar | Send messages            | OAuth2 |
| [Slack](skills/slack/)       | Chat           | Channels, search, users      | Send messages, reactions | Cookie |
| [Jira](skills/sigcli-auth/)  | Issue tracking | Search, issues, sprints      | Create, update issues    | Cookie |
| [V2EX](skills/v2ex/)         | Forum          | Hot, search, topics, users   | Post, reply, favorite    | Cookie |
| [Zhihu](skills/zhihu/)       | Q&A            | Hot, search, answers, users  | Read-only (anti-crawler) | Cookie |
| [Reddit](skills/reddit/)     | Forum          | Hot, search, posts, users    | Post, comment, vote      | Cookie |
| [Bilibili](skills/bilibili/) | Video          | Hot, search, comments, users | Like, coin, favorite     | Cookie |
| [YouTube](skills/youtube/)   | Video          | Search, channels, comments   | Like, subscribe          | Cookie |
| [X (Twitter)](skills/x/)     | Social         | Profiles, tweets, trending   | Like, post, retweet      | Cookie |

Install skills for your AI agent:

```bash
git clone https://github.com/sigcli/sigcli.git
cd sigcli/skills && ./install.sh
```

## Documentation

Full docs, configuration, strategies, SDK, and AI agent integration guide at **[sigcli.ai](https://sigcli.ai)**.

## License

[MIT](LICENSE)
