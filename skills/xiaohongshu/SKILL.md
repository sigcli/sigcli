---
name: xiaohongshu
description: 'Interact with Xiaohongshu (小红书, RED, Little Red Book) — search notes, read note details, view comments, browse user profiles and posts, get home feed, like, favorite, comment, and follow. Use this skill whenever the user mentions Xiaohongshu, 小红书, RED, RedNote, Little Red Book, wants to search for lifestyle/beauty/travel content, read XHS discussions, look up XHS users, or browse trending notes. Also trigger when the user pastes a xiaohongshu.com URL (e.g. xiaohongshu.com/explore/noteid) or mentions an XHS note ID.'
---

# Xiaohongshu Skill

This skill provides authentication for Xiaohongshu (小红书) via sigcli, combined with [XhsSkills](https://github.com/cv-cat/XhsSkills) for API access.

## Architecture

```
sigcli (cookie producer) ──► XhsSkills (API consumer)
  sig login xiaohongshu        xhs_api_tool.py call pc <method> --params '{"cookies_str": "..."}'
```

- **sigcli** handles browser login and cookie extraction
- **XhsSkills** (cv-cat/XhsSkills) handles API signing (x-s, x-s-common, x-t, x-rap-param) and requests

## Setup

### 1. Configure sigcli provider

Add the config from `references/provider-config.yaml` to `~/.sig/config.yaml` under `providers:`.

### 2. Login

```bash
sig login xiaohongshu
```

This opens a browser. Scan the QR code with your Xiaohongshu app to login.

### 3. Verify

```bash
sig status xiaohongshu
# Should show: configured: true, valid: true
```

### 4. Install XhsSkills

```bash
git clone https://github.com/cv-cat/XhsSkills.git
cd XhsSkills
pip install -r skills/xhs-apis/scripts/requirements.txt
cd skills/xhs-apis/scripts && npm install
```

## Usage

### Get cookie from sigcli

```bash
# Get the full cookie string
COOKIE=$(sig get xiaohongshu --no-redaction --format value)
```

Or use `sig run` to inject as environment variable:

```bash
sig run xiaohongshu -- bash -c 'echo $SIG_XIAOHONGSHU_COOKIE'
```

### Call XHS APIs via XhsSkills

```bash
# List available methods
python3 XhsSkills/skills/xhs-apis/scripts/xhs_api_tool.py list

# Search notes
sig run xiaohongshu -- bash -c 'python3 XhsSkills/skills/xhs-apis/scripts/xhs_api_tool.py call pc search_note --params "{\"cookies_str\": \"$SIG_XIAOHONGSHU_COOKIE\", \"keyword\": \"AI\", \"page\": 1, \"page_size\": 20, \"sort\": \"general\", \"note_type\": 0}"'

# Get note detail
sig run xiaohongshu -- bash -c 'python3 XhsSkills/skills/xhs-apis/scripts/xhs_api_tool.py call pc get_note_info --params "{\"cookies_str\": \"$SIG_XIAOHONGSHU_COOKIE\", \"url\": \"https://www.xiaohongshu.com/explore/NOTE_ID?xsec_token=TOKEN\"}"'

# Get home feed
sig run xiaohongshu -- bash -c 'python3 XhsSkills/skills/xhs-apis/scripts/xhs_api_tool.py call pc get_homefeed_recommend --params "{\"cookies_str\": \"$SIG_XIAOHONGSHU_COOKIE\", \"category\": \"homefeed_recommend\", \"cursor_score\": \"\", \"refresh_type\": 1, \"note_index\": 0}"'

# Get user notes
sig run xiaohongshu -- bash -c 'python3 XhsSkills/skills/xhs-apis/scripts/xhs_api_tool.py call pc get_user_notes --params "{\"cookies_str\": \"$SIG_XIAOHONGSHU_COOKIE\", \"user_id\": \"USER_ID\"}"'

# Get comments
sig run xiaohongshu -- bash -c 'python3 XhsSkills/skills/xhs-apis/scripts/xhs_api_tool.py call pc get_note_comments --params "{\"cookies_str\": \"$SIG_XIAOHONGSHU_COOKIE\", \"note_id\": \"NOTE_ID\", \"xsec_token\": \"TOKEN\"}"'
```

## Available API Methods

### PC namespace (public site)

| Method                     | Description                |
| -------------------------- | -------------------------- |
| `search_note`              | Search notes by keyword    |
| `search_user`              | Search users               |
| `get_note_info`            | Get note detail by URL     |
| `get_note_comments`        | Get comments for a note    |
| `get_note_sub_comments`    | Get sub-comments (replies) |
| `get_user_info`            | Get user profile           |
| `get_user_notes`           | Get user's published notes |
| `get_homefeed_recommend`   | Get recommended feed       |
| `get_homefeed_all_channel` | Get all feed channels      |
| `like_note`                | Like a note                |
| `like_comment`             | Like a comment             |
| `collect_note`             | Favorite a note            |
| `uncollect_note`           | Unfavorite a note          |
| `comment_note`             | Post a comment             |
| `comment_user`             | Reply to a comment         |
| `follow_user`              | Follow a user              |
| `unfollow_user`            | Unfollow a user            |

### Creator namespace (creator platform)

| Method                | Description               |
| --------------------- | ------------------------- |
| `search_topic`        | Search topics for tagging |
| `search_location`     | Search locations          |
| `upload_media`        | Upload image/video        |
| `post_note`           | Publish a note            |
| `get_published_notes` | Get your published notes  |
| `get_file_info`       | Get uploaded file info    |

## Environment Variables

When using `sig run xiaohongshu`, the following environment variables are injected:

| Variable                 | Description                         |
| ------------------------ | ----------------------------------- |
| `SIG_XIAOHONGSHU_COOKIE` | Full cookie string for API requests |

## Error Handling

- If API returns "登录已过期" or session errors: run `sig login xiaohongshu` to refresh
- If CAPTCHA triggered (461): wait a few minutes before retrying
- If account abnormal (300011): wait 24h or use a different network

## Key Concepts

- **xsec_token**: Per-note security token, obtained from search results or note URLs. Required for note detail and comments.
- **cookies_str**: Full cookie string from sig. Pass directly to XhsSkills methods.
- **Signing**: All handled internally by XhsSkills (x-s, x-s-common, x-t, x-rap-param). You only provide cookies.
