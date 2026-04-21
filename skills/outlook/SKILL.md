---
name: outlook
description: 'Interact with Outlook email — read inbox, send emails, search messages, reply/forward, manage folders, download attachments. Use this skill whenever the user mentions email, Outlook, inbox, mail, send email, check email, unread messages, email search, attachments, reply to email, forward email, 邮件, 收件箱, or wants to read, send, search, reply to, forward, or manage emails.'
---

# Outlook Email

Read, search, and manage emails via Microsoft Graph API.

## Sending Emails — Draft Mode

The Graph API token lacks `Mail.Send` scope (your organization's Azure AD policy), so sending is done via **draft creation**:

- `outlook_send.py` creates a draft in Drafts folder — user clicks Send in Outlook
- `outlook_reply.py` creates a reply/forward draft — user clicks Send in Outlook
- The draft's `webLink` opens directly in Outlook Web for quick sending

## Authentication

This skill requires a **Graph API token** from Signet. Use `sig run` to inject it as an environment variable:

```bash
sig run ms-graph -- bash -c 'python3 scripts/outlook_messages.py --graph-token "$SIG_MS_GRAPH_TOKEN" --unread-only --limit 10'
```

The default Signet provider is `ms-graph`. The env var name follows the rule: `SIG_<PROVIDER>_TOKEN` where `<PROVIDER>` is the provider name uppercased with `-` replaced by `_`. If the user has a different provider name, derive the env var accordingly.

**Note:** `sig run` for bearer providers sets `SIG_<PROVIDER>_TOKEN` to the raw JWT (without `Bearer` prefix). The scripts add `Bearer` themselves.

If a script returns 401 or auth error, re-authenticate:

```bash
sig login https://teams.cloud.microsoft/v2/
```

Then retry the `sig run` command.

**Signet provider config** (already in `sigcli-auth/SKILL.md`):

```yaml
ms-graph:
    domains: ['graph.microsoft.com']
    entryUrl: https://teams.cloud.microsoft/v2/
    strategy: oauth2
    config:
        audiences: ['https://graph.microsoft.com']
```

No separate Outlook-specific provider is needed — the Graph API audience covers all mail endpoints. The token is obtained via the Teams portal entry URL, which grants `Mail.Read` and `Mail.ReadWrite` scopes.

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

| Script                   | Purpose                              | Token |
| ------------------------ | ------------------------------------ | ----- |
| `outlook_folders.py`     | List mail folders                    | Graph |
| `outlook_messages.py`    | List messages from a folder          | Graph |
| `outlook_read.py`        | Read full message by ID              | Graph |
| `outlook_search.py`      | Search emails with KQL               | Graph |
| `outlook_send.py`        | Send a new email                     | Graph |
| `outlook_reply.py`       | Reply/ReplyAll/Forward               | Graph |
| `outlook_manage.py`      | Mark read/unread, move, delete, flag | Graph |
| `outlook_attachments.py` | List/download attachments            | Graph |

### outlook_folders.py

```
--graph-token TOKEN       Graph API Bearer token (required)
--include-children        Also list child folders (flag)
```

### outlook_messages.py

```
--graph-token TOKEN       Graph API Bearer token (required)
--folder FOLDER           Folder name or ID (default: Inbox)
--limit N                 Max messages (default: 20, max: 50)
--since ISO_DATE          Only messages after this date
--until ISO_DATE          Only messages before this date
--unread-only             Only show unread messages (flag)
```

Well-known folder names: `Inbox`, `SentItems`, `Drafts`, `DeletedItems`, `Archive`, `JunkEmail`.

### outlook_read.py

```
--graph-token TOKEN       Graph API Bearer token (required)
--message-id ID           Message ID (required)
--format FORMAT           "text" (default) or "html"
```

### outlook_search.py

```
--graph-token TOKEN       Graph API Bearer token (required)
--query TEXT              KQL search query (required)
--folder FOLDER           Restrict to folder (optional)
--limit N                 Max results (default: 20, max: 50)
```

### outlook_send.py

```
--graph-token TOKEN       Graph API Bearer token (required)
--to ADDRESSES            Comma-separated recipient emails (required)
--subject TEXT            Email subject (required)
--body TEXT               Email body content (required)
--cc ADDRESSES            Comma-separated CC addresses
--bcc ADDRESSES           Comma-separated BCC addresses
--body-type TYPE          "text" (default) or "html"
--importance LEVEL        "low", "normal" (default), or "high"
--no-save-to-sent         Do not save to Sent Items
```

### outlook_reply.py

```
--graph-token TOKEN       Graph API Bearer token (required)
--message-id ID           Original message ID (required)
--action ACTION           "reply", "replyAll", or "forward"
--body TEXT               Reply/forward body content (required)
--to ADDRESSES            Recipient addresses (required for forward)
```

### outlook_manage.py

```
--graph-token TOKEN       Graph API Bearer token (required)
--message-id ID           Message ID (required)
--action ACTION           "read", "unread", "move", "delete", "flag", "unflag"
--folder FOLDER           Destination folder (required for move)
```

### outlook_attachments.py

```
--graph-token TOKEN       Graph API Bearer token (required)
--message-id ID           Message ID (required)
--download ATTACHMENT_ID  Download a specific attachment (optional)
--output-dir DIR          Directory for downloaded file (default: /tmp)
```

## Safety

**Always show the user the draft (recipients, subject, body preview) and get explicit confirmation before calling `outlook_send.py`, `outlook_reply.py`, or `outlook_manage.py --action delete`.**

## KQL Search Syntax

Use KQL (Keyword Query Language) with `outlook_search.py`:

```
"quarterly report"                # Subject, body, or attachment name
from:jane.doe@example.com        # From a specific sender
to:john@example.com              # Sent to someone
subject:"weekly standup"          # In subject line
hasattachment:true                # Has attachments
received>=2026-04-01              # Received after date
from:jane subject:report          # Combined filters
```

Note: `$orderby` is not supported with `$search` — results are returned by relevance.

## Key Concepts

**Folder names** — Use well-known names (`Inbox`, `SentItems`, `Drafts`, `DeletedItems`, `Archive`, `JunkEmail`) or folder IDs from `outlook_folders.py`.

**Message IDs** — Long opaque strings (e.g., `AAMkAD...`). Get from `outlook_messages.py` or `outlook_search.py`, then use with `outlook_read.py`, `outlook_reply.py`, `outlook_manage.py`, `outlook_attachments.py`.

**Conversation threading** — Each message has a `conversationId`. To see a full email thread: read one message, note its `conversationId`, then search/filter for other messages in that conversation.

**HTML bodies** — `outlook_read.py` converts HTML to plain text by default. Use `--format html` to get the raw HTML.

**Time parameters** — Accept both `YYYY-MM-DD` and full ISO 8601 (`2026-04-13T09:00:00Z`).

## Error Handling

| Error                 | Cause                      | Fix                                                |
| --------------------- | -------------------------- | -------------------------------------------------- |
| 401 Unauthorized      | Token expired              | Re-authenticate via `sig login`, get fresh token   |
| 403 Forbidden         | Insufficient permissions   | Check Graph API permissions (Mail.Read, Mail.Send) |
| 404 Not found         | Invalid message/folder ID  | Verify ID from a list or search                    |
| 429 Too Many Requests | Rate limited               | Wait and retry                                     |
| `MISSING_ARGS`        | Required arguments missing | Check script `--help`                              |

## Workflow Examples

### Check inbox (recent unread emails)

1. `sig run ms-graph -- bash -c 'python3 scripts/outlook_messages.py --graph-token "$SIG_MS_GRAPH_TOKEN" --unread-only --limit 10'`

### Read a specific email

1. List messages to find the ID: `sig run ms-graph -- bash -c 'python3 scripts/outlook_messages.py --graph-token "$SIG_MS_GRAPH_TOKEN" --limit 5'`
2. Read full content: `sig run ms-graph -- bash -c 'python3 scripts/outlook_read.py --graph-token "$SIG_MS_GRAPH_TOKEN" --message-id "$MSG_ID"'`

### Search for emails

1. `sig run ms-graph -- bash -c 'python3 scripts/outlook_search.py --graph-token "$SIG_MS_GRAPH_TOKEN" --query "from:jane.doe@example.com subject:report"'`

### Send an email

1. **Show draft to user and get confirmation**
2. `sig run ms-graph -- bash -c 'python3 scripts/outlook_send.py --graph-token "$SIG_MS_GRAPH_TOKEN" --to "jane.doe@example.com" --subject "Meeting follow-up" --body "Hi Jane, ..."'`

### Reply to an email

1. Read the email first: `sig run ms-graph -- bash -c 'python3 scripts/outlook_read.py --graph-token "$SIG_MS_GRAPH_TOKEN" --message-id "$MSG_ID"'`
2. **Show reply draft to user and get confirmation**
3. `sig run ms-graph -- bash -c 'python3 scripts/outlook_reply.py --graph-token "$SIG_MS_GRAPH_TOKEN" --message-id "$MSG_ID" --action reply --body "Thanks, sounds good!"'`

### Forward an email

1. **Show forward draft to user and get confirmation**
2. `sig run ms-graph -- bash -c 'python3 scripts/outlook_reply.py --graph-token "$SIG_MS_GRAPH_TOKEN" --message-id "$MSG_ID" --action forward --body "FYI" --to "colleague@example.com"'`

### Download an attachment

1. List attachments: `sig run ms-graph -- bash -c 'python3 scripts/outlook_attachments.py --graph-token "$SIG_MS_GRAPH_TOKEN" --message-id "$MSG_ID"'`
2. Download: `sig run ms-graph -- bash -c 'python3 scripts/outlook_attachments.py --graph-token "$SIG_MS_GRAPH_TOKEN" --message-id "$MSG_ID" --download "$ATTACHMENT_ID" --output-dir ~/Downloads'`

### Check mail folders

1. `sig run ms-graph -- bash -c 'python3 scripts/outlook_folders.py --graph-token "$SIG_MS_GRAPH_TOKEN" --include-children'`
