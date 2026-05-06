# @sigcli/skills

AI agent skills for authenticated web access via [sigcli](https://github.com/sigcli/sigcli).

Give your AI agent (Claude, Cursor, Windsurf, Cline) the ability to interact with real websites — read feeds, send messages, post content — using your authenticated sessions managed by sigcli.

## Quick Start

```bash
npx @sigcli/skills
```

This launches an interactive installer that auto-detects your AI agent and lets you pick which skills to install.

## Usage

```bash
npx @sigcli/skills [options] [skill...]
```

### Options

| Flag             | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| `--agent <name>` | Target agent: `claude`, `cursor`, `windsurf`, `cline` (auto-detected if omitted) |
| `--dest <path>`  | Custom installation directory                                                    |
| `--all`          | Install (or uninstall) all skills                                                |
| `--list`         | List available skills and their install status                                   |
| `--uninstall`    | Remove installed skills                                                          |
| `--help`, `-h`   | Show help                                                                        |

### Examples

```bash
# Install all skills for Claude
npx @sigcli/skills --all --agent claude

# Install specific skills
npx @sigcli/skills outlook slack x

# Install for Cursor
npx @sigcli/skills --agent cursor

# List available skills
npx @sigcli/skills --list

# Uninstall all skills
npx @sigcli/skills --uninstall --all
```

## Bundled Skills

| Skill          | Platform        | Capabilities                                      |
| -------------- | --------------- | ------------------------------------------------- |
| **bilibili**   | Bilibili (B站)  | Browse videos, search, like, coin, favorite       |
| **hackernews** | Hacker News     | Browse stories, search, comment, vote, submit     |
| **linkedin**   | LinkedIn        | View profiles/feed, search, post, connect         |
| **msteams**    | Microsoft Teams | Send/read messages, search, calendar, transcripts |
| **outlook**    | Outlook         | Read/send email, search, manage folders           |
| **reddit**     | Reddit          | Browse, search, post, comment, vote               |
| **slack**      | Slack           | Read channels, search, send messages, reactions   |
| **v2ex**       | V2EX            | Browse topics, search, reply, thank               |
| **x**          | X (Twitter)     | View/post tweets, like, retweet, follow           |
| **youtube**    | YouTube         | Search, browse channels, comments, like           |
| **zhihu**      | Zhihu (知乎)    | Browse Q&A, search, view profiles                 |

## How It Works

1. **Install skills** — `npx @sigcli/skills` copies skill files to your agent's skills directory (e.g. `~/.claude/skills/`)
2. **Authenticate** — Use `sig login <provider>` to authenticate with each platform via browser
3. **Use** — Your AI agent reads the skill docs and calls the bundled Python scripts with credentials injected by sigcli

```
Agent reads SKILL.md → calls script → sigcli injects credentials → authenticated request
```

## Authentication

Skills rely on sigcli for credential management. Install the CLI first:

```bash
npm install -g @sigcli/cli
```

Then authenticate with the platforms you want to use:

```bash
sig login slack.com
sig login reddit.com
sig login x.com
```

Your agent uses `sig run` to execute scripts with credentials injected as environment variables:

```bash
sig run slack -- python3 scripts/read_channel.py --channel general --limit 20
```

## Requirements

- Node.js >= 18
- Python 3 (for skill scripts)
- [sigcli](https://github.com/sigcli/sigcli) for authentication

## License

MIT
