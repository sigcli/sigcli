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

| Skill         | Platform     | Read                            | Write                       | Auth   |
| ------------- | ------------ | ------------------------------- | --------------------------- | ------ |
| `sigcli-auth` | Auth         | Strategy guide, error recovery  | —                           | —      |
| `outlook`     | Email        | Inbox, search, folders          | Send, reply, forward        | OAuth2 |
| `msteams`     | Chat         | Messages, channels, calendar    | Send messages               | OAuth2 |
| `slack`       | Chat         | Channels, search, users         | Send messages, reactions    | Cookie |
| `v2ex`        | Forum        | Hot, search, topics, users      | Post, reply, favorite       | Cookie |
| `zhihu`       | Q&A          | Hot, search, answers, users     | Read-only (anti-crawler)    | Cookie |
| `reddit`      | Forum        | Hot, search, posts, users       | Post, comment, vote, save   | Cookie |
| `bilibili`    | Video        | Hot, ranking, search, subtitles | Like, coin, favorite        | Cookie |
| `youtube`     | Video        | Search, channels, comments      | Like, subscribe             | Cookie |
| `x`           | Social       | Profiles, tweets, trending      | Post, like, retweet, follow | Cookie |
| `xiaohongshu` | Social       | Notes, search, feed, users      | Like, collect, comment      | Cookie |
| `hackernews`  | Forum        | Top, ask, show, jobs, search    | Submit, comment, vote       | Cookie |
| `linkedin`    | Professional | Profiles, feed, jobs, search    | Post, like, comment, follow | Cookie |

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
