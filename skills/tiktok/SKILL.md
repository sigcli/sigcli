---
name: tiktok
description: 'Provide authenticated cookies for TikTok (www.tiktok.com). Use this skill whenever the user needs TikTok cookies for scraping tools, downloaders, or needs to authenticate with TikTok services. Trigger when the user mentions TikTok, tiktok cookies, or wants to use tools that require TikTok login cookies.'
---

# TikTok Skill (Cookie Provider)

This skill provides authenticated cookies for TikTok via sigcli.

| Provider | Domain         | Use case                          |
| -------- | -------------- | --------------------------------- |
| `tiktok` | www.tiktok.com | Scraping, downloading, API access |

## Setup

### 1. Configure provider

Add the config from `references/provider-config.yaml` to `~/.sig/config.yaml` under `providers:`.

Adjust `networkProxy` to your proxy URL if needed (TikTok is blocked in China).

### 2. Login

```bash
sig login tiktok --mode visible
```

Opens browser with proxy, navigate to TikTok and log in (or sign up).

### 3. Verify

```bash
sig status tiktok
# Should show: valid: true
```

## Get cookies

```bash
sig get tiktok --no-redaction --format value
# Output: sessionid=xxx; tt_chain_token=yyy; ...
```

## Usage with TikTokDownloader

```bash
# Copy cookie to clipboard for TikTokDownloader's "从剪贴板读取" mode
sig get tiktok --no-redaction --format value | pbcopy

# Or inject as environment variable
sig run tiktok -- python main.py
```

## Validation

- Endpoint: `https://www.tiktok.com/setting`
- Logged in: returns 200 (settings page)
- Not logged in: 302 redirect to `/foryou`
- No validateRule needed (redirect detection is sufficient)

## Notes

- TikTok requires proxy access from China — `networkProxy: socks5://127.0.0.1:3333`
- First login may take longer (registration + verification)
- Use `--mode visible` for first login; subsequent logins can use auto mode
- TTL is set to 2h; use `sig watch add tiktok` for auto-refresh
