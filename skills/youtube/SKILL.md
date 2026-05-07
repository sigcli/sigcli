---
name: youtube
description: 'Interact with YouTube — search videos, get video details, browse channels, read comments, view trending, browse playlists, like/unlike videos, subscribe/unsubscribe to channels. Use this skill whenever the user mentions YouTube, wants to search for videos, get video info, read comments, browse a channel, check trending videos, view a playlist, or interact with YouTube content. Also trigger when the user pastes a YouTube URL (e.g. youtube.com/watch?v=..., youtu.be/...) or mentions a YouTube channel.'
---

# YouTube

Search videos, get video details, browse channels, read comments, view trending, browse playlists, and interact with YouTube.

## Skill Directory

`<SKILL_DIR>` is the directory containing this SKILL.md file. Determine it ONCE at the start and reuse it.

## Fast Gate (run this FIRST, every time)

Run these commands silently — do NOT ask the user anything:

```bash
sig status youtube 2>&1
```

Check the JSON `"valid"` field:

- `"valid": true` — proceed to detect proxy below.
- `"valid": false` — auto-run `sig login youtube` (do NOT ask user), then re-check `sig status youtube`.
- Command not found or provider not found — run Full Setup (see Authentication section).

**Detect proxy** (do NOT ask user — read from config):

```bash
grep -A15 "^\s*youtube:" ~/.sig/config.yaml | grep networkProxy | awk '{print $2}'
```

If this outputs a URL (e.g. `socks5://127.0.0.1:1234`), use it as `HTTPS_PROXY=<url> HTTP_PROXY=<url>` in ALL python3 commands. If empty, omit proxy. NEVER ask the user about proxy — it's in the config.
NOTE: if using socks5 protocol, convert to socks5h for python scripts, e.g. `socks5://127.0.0.1:1234` becomes `socks5h://127.0.0.1:1234`

Once valid + proxy detected, go straight to executing the user's request.

---

## Authentication

**ALWAYS configure the provider first.** Run `sig providers` — if the provider is not listed:

1. Read `references/provider-config.yaml` and append the block to `~/.sig/config.yaml` under `providers:`
2. Ask the user if they need a proxy to access this site (if yes, add `networkProxy: <url>` under the provider)
3. Run `sig login <provider>` (with `--network-proxy` if proxy was specified)

Do this automatically before any operation — never skip because reads may work without auth.

**Read operations** work without authentication via YouTube's public InnerTube API. No credentials needed.

**Write operations** (like, subscribe) require a **session cookie** with SAPISID. Use `sig run` to inject it:

```bash
sig run youtube -- bash -c 'python3 scripts/youtube_like.py --cookie "$SIG_YOUTUBE_COOKIE" --video dQw4w9WgXcQ'
```

The default SigCLI provider is `youtube`. The env var is `SIG_YOUTUBE_COOKIE`.

> **Note:** If `sig login` creates the provider as `www-youtube` (from the domain), the env var will be `SIG_WWW_YOUTUBE_COOKIE`. You can rename it: `sig rename www-youtube youtube`.

If a write script returns auth error, re-authenticate automatically (do NOT ask the user):

```bash
sig login youtube
```

`sig login` runs headless browser extraction and completes in seconds without user interaction. Then retry the failed command.

**SigCLI provider config:**

```yaml
youtube:
    domains: [www.youtube.com, youtube.com]
    entryUrl: https://www.youtube.com/
    validateUrl: https://www.youtube.com/account
    strategy: browser
    ttl: '2h'
    extract:
        - from: cookies
          as: cookie
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
```

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

1. `python3 scripts/youtube_video.py --video dQw4w9WgXcQ`
2. Or with URL: `python3 scripts/youtube_video.py --video "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`

### Search for videos

1. `python3 scripts/youtube_search.py --query "python tutorial" --limit 10`

### Browse a channel

1. `python3 scripts/youtube_channel.py --channel @RickAstleyYT --limit 5`
2. Or by ID: `python3 scripts/youtube_channel.py --channel UCuAXFkgsw1L7xaCfnd5JJOw`

### Read video comments

1. `python3 scripts/youtube_comments.py --video dQw4w9WgXcQ --limit 30`

### View trending videos

1. `python3 scripts/youtube_trending.py --limit 10`

### Browse a playlist

1. `python3 scripts/youtube_playlist.py --playlist PLxxxxxxxx --limit 20`
2. Or with URL: `python3 scripts/youtube_playlist.py --playlist "https://www.youtube.com/playlist?list=PLxxxxxxxx"`

### Like a video

1. `sig run youtube -- bash -c 'python3 scripts/youtube_like.py --cookie "$SIG_YOUTUBE_COOKIE" --video dQw4w9WgXcQ'`

### Unlike a video

1. `sig run youtube -- bash -c 'python3 scripts/youtube_like.py --cookie "$SIG_YOUTUBE_COOKIE" --video dQw4w9WgXcQ --action unlike'`

### Subscribe to a channel

1. `sig run youtube -- bash -c 'python3 scripts/youtube_subscribe.py --cookie "$SIG_YOUTUBE_COOKIE" --channel @RickAstleyYT'`

### Unsubscribe from a channel

1. `sig run youtube -- bash -c 'python3 scripts/youtube_subscribe.py --cookie "$SIG_YOUTUBE_COOKIE" --channel UCuAXFkgsw1L7xaCfnd5JJOw --action unsubscribe'`
