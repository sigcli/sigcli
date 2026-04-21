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
| `slack`       | Read channels, search messages, check unreads, send messages, manage reactions        |

## Build Your Own

A skill is a directory with a `SKILL.md` file and optional Python scripts. See the full guide at [sigcli.ai/docs#skills-build](https://sigcli.ai/docs#skills-build).

Quick version:

```
my-service/
  SKILL.md              # YAML frontmatter + markdown guide for the agent
  scripts/
    list_items.py       # Python script: argparse CLI, JSON output
    requirements.txt    # requests>=2.28.0
  tests/
    test_list_items.py  # pytest + responses library for HTTP mocking
```

Register in `install.sh` by adding the directory name to `ALL_SKILLS`.

## Running Tests

```bash
pip install requests beautifulsoup4 pytest responses
python -m pytest -v
```
