# Sigcli Skills

AI agent skills for authenticated access to web services via sigcli.

## Install

```bash
# Auto-detect your agent (Claude Code, Cursor, Windsurf, Cline)
./install.sh

# Specify agent explicitly
./install.sh --agent cursor

# Custom install path
./install.sh --dest ~/my/agent/skills

# List available skills
./install.sh --list

# Uninstall
./install.sh --uninstall
```

## Available Skills

| Skill         | Description                                                                           |
| ------------- | ------------------------------------------------------------------------------------- |
| `sigcli-auth` | Authenticate with any web service — strategy guide, command reference, error recovery |
| `outlook`     | Read, send, search, reply, forward, and manage Outlook emails via Microsoft Graph     |
| `msteams`     | Send and read messages, search conversations, look up people, check calendar          |
| `jira`        | Search, create, update, and manage Jira issues, sprints, and boards                   |
| `slack`       | Read channels, search messages, check unreads, send messages, manage reactions        |

## Adding Skills

Each skill is a directory with a `SKILL.md` file. Add new skills by creating a directory under `skills/` and adding it to the `ALL_SKILLS` list in `install.sh`.
