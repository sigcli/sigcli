---
name: youtube
description: 'Interact with YouTube — search videos, get video details, browse channels, read comments, view trending, browse playlists, like/unlike videos, subscribe/unsubscribe to channels. Use this skill whenever the user mentions YouTube, wants to search for videos, get video info, read comments, browse a channel, check trending videos, view a playlist, or interact with YouTube content. Also trigger when the user pastes a YouTube URL (e.g. youtube.com/watch?v=..., youtu.be/...) or mentions a YouTube channel.'
---

# YouTube

Search videos, get video details, browse channels, read comments, view trending, browse playlists, and interact with YouTube.

## Skill Directory

`<SKILL_DIR>` is the directory containing this SKILL.md file. Determine it ONCE at the start and reuse it.

## Setup (run FIRST — every time, before any operation)

You MUST complete this setup before running any script. Do NOT skip this step.

```bash
sig status youtube 2>&1
```

Check the JSON output fields `configured` and `valid`:

- **`configured: false`** → run Provider Setup below. Do NOT proceed without completing it.
- **`valid: false` (but configured: true)** → run `sig login youtube`, then re-check.
- **`valid: true`** → detect proxy (see below), then execute the user's request.

### Provider Setup

1. Read `<SKILL_DIR>/references/provider-config.yaml`
2. Append the provider block to `~/.sig/config.yaml` under `providers:`
3. Ask the user: "Do you need a proxy to access this site?" — if yes, add `networkProxy: <url>` under the provider in config.yaml
4. Run `sig login youtube` (with `--network-proxy <url>` if proxy was specified)
5. Verify: run `sig status youtube` again — must show `valid: true` before proceeding

### Proxy Detection (after provider is valid)

```bash
grep -A15 "^\s*youtube:" ~/.sig/config.yaml | grep networkProxy | awk '{print $2}'
```

If this outputs a URL, prefix ALL python3 commands with `HTTPS_PROXY=<url> HTTP_PROXY=<url>`.
If using socks5, convert to socks5h for python (e.g. `socks5://...` → `socks5h://...`).
If empty, no proxy needed.

## Running Scripts

All scripts require setup to be completed first (see above).

**Read operations** — use `sig run` to inject cookie (enables authenticated features):

```bash
sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_video.py --cookie "$SIG_YOUTUBE_COOKIE" --video dQw4w9WgXcQ'
```

**Write operations** — require `sig run` (cookie is mandatory):

```bash
sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_like.py --cookie "$SIG_YOUTUBE_COOKIE" --video dQw4w9WgXcQ'
```

Env var: `SIG_YOUTUBE_COOKIE`

**On auth error (401/403):** run `sig login youtube` automatically (no user prompt), then retry.

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script                | Purpose                  | Auth |
| --------------------- | ------------------------ | ---- |
| `youtube_video.py`    | Video details            | None |
| `youtube_search.py`   | Search videos            | None |
| `youtube_channel.py`  | Channel info and videos  | None |
| `youtube_comments.py` | Video comments           | None |
| `youtube_trending.py` | Trending videos          | None |
| `youtube_playlist.py` | Playlist info and videos | None |

### Write Operations

| Script                 | Purpose               | Auth     |
| ---------------------- | --------------------- | -------- |
| `youtube_like.py`      | Like/unlike a video   | Required |
| `youtube_subscribe.py` | Subscribe/unsubscribe | Required |

### youtube_video.py

```
--video URL           YouTube video URL or video ID (required)
```

### youtube_search.py

```
--query TEXT          Search query (required)
--limit N            Max results (default: 20)
```

### youtube_channel.py

```
--channel ID         Channel ID (UCxxxx), handle (@name), or URL (required)
--limit N            Max recent videos (default: 10)
```

### youtube_comments.py

```
--video URL          YouTube video URL or video ID (required)
--limit N            Max comments (default: 20)
```

### youtube_trending.py

```
--limit N            Max videos (default: 20)
```

### youtube_playlist.py

```
--playlist ID        Playlist URL or ID (PLxxxxxx) (required)
--limit N            Max videos (default: 50)
```

### youtube_like.py

```
--cookie COOKIE      YouTube session cookie (required)
--video URL          YouTube video URL or video ID (required)
--action ACTION      Action: like, unlike (default: like)
```

### youtube_subscribe.py

```
--cookie COOKIE      YouTube session cookie (required)
--channel ID         Channel ID (UCxxxx), handle (@name), or URL (required)
--action ACTION      Action: subscribe, unsubscribe (default: subscribe)
```

## Safety

**`youtube_like.py` and `youtube_subscribe.py` are reversible** — use `--action unlike` to remove a like, `--action unsubscribe` to unsubscribe.

## Key Concepts

**Video IDs** — `youtube_video.py` and `youtube_comments.py` accept: bare ID (`dQw4w9WgXcQ`), full URL (`https://www.youtube.com/watch?v=dQw4w9WgXcQ`), short link (`https://youtu.be/dQw4w9WgXcQ`), or shorts/embed/live URLs.

**Channel IDs** — Accept `UCxxxx` channel IDs, `@handle` format, or full channel URLs. Handles are resolved to channel IDs automatically.

**Playlist IDs** — Accept `PLxxxxxx` playlist IDs or full playlist URLs. The `list=` parameter is extracted from URLs.

**InnerTube API** — All operations use YouTube's InnerTube API (`/youtubei/v1/`), which is the same internal API the YouTube website uses. Read operations require no auth; write operations require SAPISIDHASH authentication derived from session cookies.

**SAPISIDHASH Auth** — Write operations compute `SAPISIDHASH {timestamp}_{SHA1(timestamp + " " + SAPISID + " " + origin)}` from the SAPISID cookie for the Authorization header.

## Error Handling

| Error           | Cause                     | Fix                                                 |
| --------------- | ------------------------- | --------------------------------------------------- |
| HTTP_403        | Forbidden or rate limited | Wait and retry                                      |
| HTTP_404        | Video/channel not found   | Check the ID is correct                             |
| AUTH_REQUIRED   | No cookie for write op    | Auto-run `sig login` (no user prompt needed), retry |
| AUTH_EXPIRED    | Session cookie expired    | Auto-run `sig login` (no user prompt needed), retry |
| INVALID_CHANNEL | Cannot resolve channel ID | Use UCxxxx format instead of handle                 |

## Workflow Examples

### Get video details

1. `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_video.py --cookie "$SIG_YOUTUBE_COOKIE" --video dQw4w9WgXcQ'`
2. Or with URL: `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_video.py --cookie "$SIG_YOUTUBE_COOKIE" --video "https://www.youtube.com/watch?v=dQw4w9WgXcQ"'`

### Search for videos

1. `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_search.py --cookie "$SIG_YOUTUBE_COOKIE" --query "python tutorial" --limit 10'`

### Browse a channel

1. `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_channel.py --cookie "$SIG_YOUTUBE_COOKIE" --channel @RickAstleyYT --limit 5'`
2. Or by ID: `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_channel.py --cookie "$SIG_YOUTUBE_COOKIE" --channel UCuAXFkgsw1L7xaCfnd5JJOw'`

### Read video comments

1. `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_comments.py --cookie "$SIG_YOUTUBE_COOKIE" --video dQw4w9WgXcQ --limit 30'`

### View trending videos

1. `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_trending.py --cookie "$SIG_YOUTUBE_COOKIE" --limit 10'`

### Browse a playlist

1. `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_playlist.py --cookie "$SIG_YOUTUBE_COOKIE" --playlist PLxxxxxxxx --limit 20'`
2. Or with URL: `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_playlist.py --cookie "$SIG_YOUTUBE_COOKIE" --playlist "https://www.youtube.com/playlist?list=PLxxxxxxxx"'`

### Like a video

1. `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_like.py --cookie "$SIG_YOUTUBE_COOKIE" --video dQw4w9WgXcQ'`

### Unlike a video

1. `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_like.py --cookie "$SIG_YOUTUBE_COOKIE" --video dQw4w9WgXcQ --action unlike'`

### Subscribe to a channel

1. `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_subscribe.py --cookie "$SIG_YOUTUBE_COOKIE" --channel @RickAstleyYT'`

### Unsubscribe from a channel

1. `sig run youtube -- bash -c 'python3 <SKILL_DIR>/scripts/youtube_subscribe.py --cookie "$SIG_YOUTUBE_COOKIE" --channel UCuAXFkgsw1L7xaCfnd5JJOw --action unsubscribe'`
