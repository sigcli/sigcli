---
name: msteams
description: 'Interact with Microsoft Teams — send and read messages, search conversations, look up people, check calendar, get meeting transcripts, and manage chats. Use this skill whenever the user mentions Teams, MS Teams, Microsoft Teams, wants to send a message, read chat history, search conversations, look up a colleague, check their calendar, find meeting recordings or transcripts, see direct reports or manager, or do anything involving Teams communication. Also trigger when the user asks about scheduling, org chart, people search, or wants to message someone.'
---

# Microsoft Teams

Send and read messages, search conversations, look up people, check calendar, get meeting transcripts, and manage chats via Microsoft Teams.

## Setup (run FIRST — every time, before any operation)

You MUST complete this setup before running any script. Do NOT skip this step.

```bash
sig status ms-teams 2>&1
sig status ms-graph 2>&1
```

Check the JSON output fields `configured` and `valid` for BOTH providers:

- **`configured: false`** → run Provider Setup below. Do NOT proceed without completing it.
- **`valid: false` (but configured: true)** → run `sig login ms-teams`, then re-check.
- **`valid: true`** → detect proxy (see below), then execute the user's request.

### Provider Setup

1. Read `<SKILL_DIR>/references/provider-config.yaml`
2. Append BOTH provider blocks (`ms-teams` and `ms-graph`) to `~/.sig/config.yaml` under `providers:`
3. Ask the user: "Do you need a proxy to access this site?" — if yes, add `networkProxy: <url>` under each provider in config.yaml
4. Run `sig login ms-teams` (with `--network-proxy <url>` if proxy was specified) — this covers both providers
5. Verify: run `sig status ms-teams` and `sig status ms-graph` again — both must show `valid: true` before proceeding

### Proxy Detection (after provider is valid)

```bash
grep -A15 "^\s*ms-teams:" ~/.sig/config.yaml | grep networkProxy | awk '{print $2}'
```

If this outputs a URL, prefix ALL python3 commands with `HTTPS_PROXY=<url> HTTP_PROXY=<url>`.
If using socks5, convert to socks5h for python (e.g. `socks5://...` → `socks5h://...`).
If empty, no proxy needed.

## Running Scripts

All scripts require setup to be completed first (see above).

## User Profile & Region Configuration

**Before using this skill**, check `memory/user-profile.md` for the user's stored profile (name, email, region, etc.). See `CLAUDE.md` for details.

All scripts support a `--region` parameter for the Teams Chat API regional endpoint. Resolution order:

1. Stored region from `memory/user-profile.md`
2. `--region` CLI argument (if provided)
3. `TEAMS_REGION` environment variable
4. Default: `apac`

Common regions: `apac`, `emea`, `amer`.

**Region:** If the region is not in `memory/user-profile.md` or the env var, ask the user once, then store it immediately in `memory/user-profile.md`.

**Profile enrichment:** When you call `teams_people.py --action profile` (or Graph `/me`), persist the user's name, email, and I-number to `memory/user-profile.md` so other skills can use them without re-querying.

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

| Script                   | Purpose                                  | Token(s)     |
| ------------------------ | ---------------------------------------- | ------------ |
| `teams_conversations.py` | List/search conversations                | Chat         |
| `teams_messages.py`      | Get messages from a conversation         | Chat         |
| `teams_send.py`          | Send message or threaded reply           | Chat         |
| `teams_chat.py`          | Find 1:1 chat or create group chat       | Chat + Graph |
| `teams_members.py`       | Get conversation members                 | Chat + Graph |
| `teams_meetings.py`      | Get recordings and transcripts           | Chat         |
| `teams_calendar.py`      | Get calendar events                      | Graph        |
| `teams_people.py`        | Search people, manager, reports, profile | Graph        |

### teams_conversations.py

```
--token TOKEN          Chat API token (required)
--search TEXT          Filter by topic, participant, or content
--limit N             Max conversations (default: 20)
--since ISO_DATE      Only conversations after this time
--until ISO_DATE      Only conversations before this time
--region REGION        Teams region (default: $TEAMS_REGION or 'apac')
```

### teams_messages.py

```
--token TOKEN          Chat API token (required)
--conversation-id ID   Conversation ID (required)
--search TEXT          Filter messages by content
--limit N             Max messages (default: 20, use 50+ for summarization)
--since ISO_DATE      Only messages after this time
--until ISO_DATE      Only messages before this time
--region REGION        Teams region (default: $TEAMS_REGION or 'apac')
```

### teams_send.py

```
--token TOKEN          Chat API token (required)
--conversation-id ID   Conversation ID (required)
--message TEXT         Message content (required)
--format FORMAT        "html" (default) or "markdown"
--parent-message-id ID Parent message ID (for threaded replies)
--region REGION        Teams region (default: $TEAMS_REGION or 'apac')
```

### teams_chat.py

```
--token TOKEN          Chat API token (required)
--graph-token TOKEN    Graph API token (required)
--query TEXT           Person name/email (finds 1:1 chat)
--members GUIDS        Comma-separated user GUIDs (creates group chat)
--topic TEXT           Group chat topic (optional)
--region REGION        Teams region (default: $TEAMS_REGION or 'apac')
```

### teams_members.py

```
--token TOKEN          Chat API token (required)
--graph-token TOKEN    Graph API token (for name resolution, optional)
--conversation-id ID   Conversation ID (required)
--region REGION        Teams region (default: $TEAMS_REGION or 'apac')
```

### teams_meetings.py

```
--token TOKEN          Chat API token (required)
--conversation-id ID   List recordings in conversation
--transcript-url URL   Fetch transcript content (Teams AMS URL only)
--region REGION        Teams region (default: $TEAMS_REGION or 'apac')
```

### teams_calendar.py

```
--graph-token TOKEN    Graph API token (required)
--range RANGE          "today", "week", or "month"
--start ISO_DATE       Custom start date (alternative to --range)
--end ISO_DATE         Custom end date (use with --start)
--limit N             Max events (default: 50)
```

### teams_people.py

```
--graph-token TOKEN    Graph API token (required)
--action ACTION        "search" (default), "manager", "reports", or "profile"
--query TEXT           Search query (required for search action)
--limit N             Max results (default: 10)
--enrich              Fetch extra details (I-number, city, country)
```

## Message Formatting

When sending messages, use `--format html` (default) for rich formatting:

```html
<b>Bold</b>, <i>Italic</i>, <a href="url">Link</a>
<ul>
    <li>Item</li>
</ul>
,
<ol>
    <li>Item</li>
</ol>
<pre>Code block</pre>
, <code>Inline code</code>
```

Or `--format markdown` for Teams markdown:

```
**bold**, _italic_, ~~strikethrough~~
`code`, [link](url), - bullet, 1. numbered
```

See `references/messaging-guide.md` for complete formatting reference.

## Key Concepts

**Conversation IDs** — Unique identifiers for chats/channels. Format varies by type:

- 1:1 chat: `19:{guid1}_{guid2}@unq.gbl.spaces`
- Group/channel: `19:{hash}@thread.tacv2`

**User GUIDs** — Microsoft 365 user identifiers (e.g., `abc12345-def6-7890-...`). Get from `teams_people.py --action search`.

**Transcript URLs** — Only Teams AMS URLs (`asyncgw.teams.microsoft.com`) work with the Chat API token. SharePoint URLs require different auth.

**Time parameters** — All use ISO 8601: `2025-01-15` or `2025-01-15T09:00:00Z`.

## Error Handling

| Error                | Cause                      | Fix                                                 |
| -------------------- | -------------------------- | --------------------------------------------------- |
| 401 Unauthorized     | Token expired              | Auto-run `sig login` (no user prompt needed), retry |
| 403 Forbidden        | No access to conversation  | User lacks permission                               |
| 404 Not found        | Invalid conversation ID    | Check ID format, conversation may not exist         |
| `NOT_FOUND` (people) | No user matching query     | Try a more specific name or email                   |
| `MISSING_ARGS`       | Required arguments missing | Check script `--help` for required args             |
| Multiple candidates  | Ambiguous people search    | Ask user to specify more precisely                  |

## Workflow Examples

### Send a message to someone

1. Find their chat:
    ```bash
    sig run ms-teams ms-graph -- bash -c 'python scripts/teams_chat.py --token "$SIG_MS_TEAMS_ACCESS_TOKEN" --graph-token "$SIG_MS_GRAPH_ACCESS_TOKEN" --query "John Smith" --region apac'
    ```
2. Send: `sig run ms-teams -- bash -c 'python scripts/teams_send.py --token "$SIG_MS_TEAMS_ACCESS_TOKEN" --conversation-id "$CONV_ID" --message "Hello!" --region apac'`

### Summarize a conversation

1. Search: `sig run ms-teams -- bash -c 'python scripts/teams_conversations.py --token "$SIG_MS_TEAMS_ACCESS_TOKEN" --search "project standup"'`
2. Get messages: `sig run ms-teams -- bash -c 'python scripts/teams_messages.py --token "$SIG_MS_TEAMS_ACCESS_TOKEN" --conversation-id "$CONV_ID" --limit 50'`
3. Summarize the returned messages

### Get a meeting transcript

1. Find recordings: `sig run ms-teams -- bash -c 'python scripts/teams_meetings.py --token "$SIG_MS_TEAMS_ACCESS_TOKEN" --conversation-id "$CONV_ID"'`
2. Fetch transcript: `sig run ms-teams -- bash -c 'python scripts/teams_meetings.py --token "$SIG_MS_TEAMS_ACCESS_TOKEN" --transcript-url "$AMS_URL"'`

### Check today's calendar

1. `sig run ms-graph -- bash -c 'python scripts/teams_calendar.py --graph-token "$SIG_MS_GRAPH_ACCESS_TOKEN" --range today'`

### Look up a colleague

1. `sig run ms-graph -- bash -c 'python scripts/teams_people.py --graph-token "$SIG_MS_GRAPH_ACCESS_TOKEN" --action search --query "Jane Doe" --enrich'`

### Check org chart

1. Manager: `sig run ms-graph -- bash -c 'python scripts/teams_people.py --graph-token "$SIG_MS_GRAPH_ACCESS_TOKEN" --action manager'`
2. Reports: `sig run ms-graph -- bash -c 'python scripts/teams_people.py --graph-token "$SIG_MS_GRAPH_ACCESS_TOKEN" --action reports'`

### Reply to a message in a thread

1. Get messages to find the parent message ID: `sig run ms-teams -- bash -c 'python scripts/teams_messages.py --token "$SIG_MS_TEAMS_ACCESS_TOKEN" --conversation-id "$CONV_ID" --limit 10'`
2. Reply: `sig run ms-teams -- bash -c 'python scripts/teams_send.py --token "$SIG_MS_TEAMS_ACCESS_TOKEN" --conversation-id "$CONV_ID" --parent-message-id "$MSG_ID" --message "Thanks!"'`
