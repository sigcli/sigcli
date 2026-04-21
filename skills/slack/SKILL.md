---
name: slack
description: 'Interact with Slack — read channels, search messages, check unreads, send messages, manage reactions, and look up users. Use this skill whenever the user mentions Slack, wants to read Slack messages, check unread channels, search Slack conversations, send a Slack message, add reactions, or look up Slack users. Also trigger when the user pastes a Slack message URL, mentions a Slack channel (#channel), or asks about Slack notifications.'
---

# Slack

Read channels, search messages, check unreads, send messages, manage reactions, and look up users via Slack.

## Authentication

Use `sig run` to inject credentials as environment variables. The shared `slack_client.py` reads `SIG_APP_SLACK_COOKIE` and `SIG_APP_SLACK_LOCAL_XOXC_TOKEN` from the environment.

```bash
sig run app-slack -- bash -c 'python scripts/slack_send.py --channel "#general" --message "Hello"'
```

The default provider is `app-slack`. The env var names follow the rule: `SIG_<PROVIDER>_COOKIE` and `SIG_<PROVIDER>_LOCAL_XOXC_TOKEN` where `<PROVIDER>` is the provider name uppercased with `-` replaced by `_`.

If you get an auth error or `invalid_auth`:

```bash
sig login app-slack
```

Then retry the `sig run` command.

## Setup

To configure `app-slack` as a provider, run:

```bash
sig init
```

When prompted for the workspace URL, enter your Slack workspace URL (e.g. `https://<your-workspace>.slack.com`).

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

| Script               | Purpose                             |
| -------------------- | ----------------------------------- |
| `slack_channels.py`  | List/filter channels                |
| `slack_history.py`   | Get channel/DM message history      |
| `slack_threads.py`   | Get thread replies                  |
| `slack_search.py`    | Search messages with filters        |
| `slack_send.py`      | Send message or threaded reply      |
| `slack_unreads.py`   | Get unread messages across channels |
| `slack_users.py`     | Search users by name/email          |
| `slack_reactions.py` | Add or remove emoji reactions       |

### slack_channels.py

```
--type TYPE           Channel types: public_channel,private_channel,im,mpim (default: public_channel,private_channel)
--sort SORT           Sort by: popularity
--limit N             Max channels (default: 100)
--cursor CURSOR       Pagination cursor from previous response
```

### slack_history.py

```
--channel ID          Channel ID (#name or @user also work) (required)
--limit LIMIT         Time range (1d, 7d, 30d) or message count (50) (default: 1d)
--cursor CURSOR       Pagination cursor
--include-activity    Include join/leave activity messages
```

### slack_threads.py

```
--channel ID          Channel ID or #name (required)
--thread-ts TS        Thread parent timestamp (required)
--limit LIMIT         Time range or count (default: 1d)
--cursor CURSOR       Pagination cursor
```

### slack_search.py

```
--query TEXT          Search query (optional if other filters provided)
--channel ID          Filter to channel
--from USER           Filter by sender (user ID or @name)
--before DATE         Before date (YYYY-MM-DD)
--after DATE          After date (YYYY-MM-DD)
--on DATE             On specific date
--threads-only        Only thread messages
--limit N             Max results (default: 20)
--cursor CURSOR       Pagination cursor
```

### slack_send.py

```
--channel ID          Channel ID, #name, or @user (required)
--message TEXT        Message content (required)
--thread-ts TS        Reply to thread (optional)
--format FORMAT       text/markdown (default) or text/plain
```

### slack_unreads.py

```
--type TYPE           Filter: all, dm, group_dm, partner, internal (default: all)
--max-channels N      Max channels to check (default: 50)
--max-messages N      Max messages per channel (default: 10)
--mentions-only       Only channels with @mentions
--summary-only        Channel list without messages
```

### slack_users.py

```
--query TEXT          Search by name, email, or display name (required)
--limit N             Max results (default: 10)
```

### slack_reactions.py

```
--action ACTION       "add" or "remove" (required)
--channel ID          Channel ID (required)
--timestamp TS        Message timestamp 1234567890.123456 (required)
--emoji NAME          Emoji name without colons, e.g. thumbsup (required)
```

## Key Concepts

**Channel IDs** — Format `Cxxxxxxxxxx`, but scripts also accept `#channel-name` or `@username` for convenience.

**Thread timestamps** — Format `1234567890.123456`. Used to identify specific messages and as parent references for threaded replies.

**Pagination** — All list endpoints use cursor-based pagination. Pass the `--cursor` value from the previous response to get the next page.

**Team ID** — Some edge APIs require your Slack team ID. To find it: open Slack in a browser, go to `<your-workspace>.slack.com`, open DevTools → Network, and look for requests with `team_id` in the response. Alternatively, run `sig run app-slack -- bash -c 'python -c "import scripts.slack_client as c; import json; client = c.SlackClient.create(); print(client.team_id)"'`.

## Error Handling

| Error               | Cause                    | Fix                                                      |
| ------------------- | ------------------------ | -------------------------------------------------------- |
| Auth error / 401    | Session expired          | `sig login app-slack`                                    |
| `invalid_auth`      | xoxc/xoxd tokens invalid | Re-login: `sig login app-slack`                          |
| `channel_not_found` | Invalid channel ID/name  | Check channel exists, use `slack_channels.py` to find it |
| `not_in_channel`    | Not a member of channel  | Join the channel first                                   |

## Workflow Examples

### Check unread messages

1. `sig run app-slack -- python scripts/slack_unreads.py`
2. To see only DMs: `sig run app-slack -- python scripts/slack_unreads.py --type dm`
3. To see only @mentions: `sig run app-slack -- python scripts/slack_unreads.py --mentions-only`

### Search for messages about a topic

1. `sig run app-slack -- bash -c 'python scripts/slack_search.py --query "deployment issue"'`
2. Filter to a channel: `sig run app-slack -- bash -c 'python scripts/slack_search.py --query "deployment" --channel #ops'`
3. Filter by date: `sig run app-slack -- bash -c 'python scripts/slack_search.py --query "deployment" --after 2025-01-01 --before 2025-01-31'`

### Read recent channel history

1. Find the channel: `sig run app-slack -- python scripts/slack_channels.py --limit 20`
2. Get messages: `sig run app-slack -- bash -c 'python scripts/slack_history.py --channel #general --limit 1d'`
3. Read a thread: `sig run app-slack -- bash -c 'python scripts/slack_threads.py --channel #general --thread-ts 1234567890.123456'`

### Send a message to someone

1. Find their DM: `sig run app-slack -- python scripts/slack_channels.py --type im`
2. Or send directly: `sig run app-slack -- bash -c 'python scripts/slack_send.py --channel @john.smith --message "Hello!"'`
3. Reply in a thread: `sig run app-slack -- bash -c 'python scripts/slack_send.py --channel #project --thread-ts 1234567890.123456 --message "Thanks!"'`

### React to a message

1. Get channel history to find the message timestamp: `sig run app-slack -- bash -c 'python scripts/slack_history.py --channel #general --limit 10'`
2. Add a reaction: `sig run app-slack -- bash -c 'python scripts/slack_reactions.py --action add --channel C0123456789 --timestamp 1234567890.123456 --emoji thumbsup'`
3. Remove a reaction: `sig run app-slack -- bash -c 'python scripts/slack_reactions.py --action remove --channel C0123456789 --timestamp 1234567890.123456 --emoji thumbsup'`
