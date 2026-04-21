# Teams Messaging & API Reference

## Conversation ID Formats

| Type       | Format                              | Example                            |
| ---------- | ----------------------------------- | ---------------------------------- |
| 1:1 chat   | `19:{guid1}_{guid2}@unq.gbl.spaces` | `19:abc123_def456@unq.gbl.spaces`  |
| Group chat | `19:{hash}@unq.gbl.spaces`          | `19:meeting_abc123@unq.gbl.spaces` |
| Channel    | `19:{hash}@thread.tacv2`            | `19:abc123@thread.tacv2`           |
| Meeting    | `19:meeting_{hash}@thread.v2`       | `19:meeting_abc123@thread.v2`      |

## Message Formatting

### HTML Format (default, `--format html`)

```html
<b>Bold</b>
<i>Italic</i>
<s>Strikethrough</s>
<a href="https://example.com">Link</a>
<ul>
    <li>Item 1</li>
    <li>Item 2</li>
</ul>
<ol>
    <li>First</li>
    <li>Second</li>
</ol>
<pre>Code block</pre>
<code>Inline code</code>
<blockquote>Quote</blockquote>
<br />Line break
<h1>Heading 1</h1>
<h2>Heading 2</h2>
<h3>Heading 3</h3>
```

### Markdown Format (`--format markdown`)

Teams uses its own markdown variant:

- `**bold**` → bold
- `_italic_` → italic
- `~~strikethrough~~` → strikethrough
- `` `code` `` → inline code
- Triple backticks → code block
- `[text](url)` → link
- `- item` → bullet list
- `1. item` → numbered list

### Mentions

To mention a user in HTML format:

```html
<at id="0">User Name</at>
```

Note: Mentions require additional metadata in the message payload that Teams Chat API handles differently from Graph API. Plain text mentions (@Name) do not generate notifications.

## Recording Detection

Messages containing meeting recordings have these characteristics:

- `messagetype` = `"RichText/Media_CallRecording"`
- Content contains `"CallRecording"` or `"Recording"`
- Content contains URLs matching `asyncgw.teams.microsoft.com`

### URL Types in Recordings

| URL Pattern                                        | Type                 | Auth                     |
| -------------------------------------------------- | -------------------- | ------------------------ |
| `*.asyncgw.teams.microsoft.com/*/views/transcript` | Transcript (VTT)     | Teams Chat API token     |
| `*.asyncgw.teams.microsoft.com/*/views/video`      | Video stream         | Teams Chat API token     |
| `*.sharepoint.com/*`                               | SharePoint recording | Separate SharePoint auth |
| `*.microsoftstream.com/*`                          | Stream recording     | Separate Stream auth     |

**Important:** Only Teams AMS URLs (asyncgw.teams.microsoft.com) work with the Chat API token. SharePoint and Stream URLs require different authentication.

## Transcript Format (VTT)

Transcripts are returned in WebVTT format with speaker tags:

```
WEBVTT

00:00:01.000 --> 00:00:05.000
<v Speaker Name>Hello everyone, welcome to the meeting.</v>

00:00:05.500 --> 00:00:09.000
<v Another Speaker>Thanks for joining.</v>
```

The `teams_meetings.py` script parses this into structured segments with speaker attribution and merges consecutive segments from the same speaker.

## Time Filtering

All time parameters use ISO 8601 format:

- Date only: `2025-01-15`
- With time: `2025-01-15T09:00:00Z`
- With timezone: `2025-01-15T09:00:00+01:00`

## User ID Formats

| Context         | Format           | Example                                |
| --------------- | ---------------- | -------------------------------------- |
| Graph API       | GUID             | `abc12345-def6-7890-abcd-ef1234567890` |
| Chat API member | `8:orgid:{guid}` | `8:orgid:abc12345-def6-...`            |
| Bot             | `28:{app-id}`    | `28:abc12345-...`                      |

## API Rate Limits

- Chat API: Generally lenient, but rapid message sending may be throttled
- Graph API: 10,000 requests per 10 minutes per app; people search is more restricted
- Calendar API: Subject to Graph throttling limits
- Directory search (`/users?$search=`): Requires `ConsistencyLevel: eventual` header and `$count=true`

## Error Patterns

| HTTP Status | Meaning       | Action                                        |
| ----------- | ------------- | --------------------------------------------- |
| 401         | Token expired | Re-authenticate via auth-mcp                  |
| 403         | No permission | User lacks access to conversation/resource    |
| 404         | Not found     | Conversation doesn't exist or wrong ID format |
| 429         | Throttled     | Wait and retry                                |
| 500         | Server error  | Retry once, then report                       |
