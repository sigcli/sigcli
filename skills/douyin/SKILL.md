---
name: douyin
description: 'Provide authenticated cookies for Douyin (抖音/TikTok China) — two providers: douyin (www.douyin.com for scraping) and douyin-live (live.douyin.com for livestream). Use this skill whenever the user needs Douyin cookies for scraping tools like DouYin_Spider, or needs to authenticate with Douyin services. Trigger when the user mentions 抖音, Douyin, TikTok China, douyin cookies, or wants to use tools that require Douyin login cookies.'
---

# Douyin Skill (Cookie Provider)

This skill provides authenticated cookies for Douyin (抖音) via sigcli. It produces two sets of cookies for different domains:

| Provider      | Domain          | Use case                                        |
| ------------- | --------------- | ----------------------------------------------- |
| `douyin`      | www.douyin.com  | Data scraping (videos, users, search, comments) |
| `douyin-live` | live.douyin.com | Livestream monitoring (弹幕, gifts, WebSocket)  |

## Setup

### 1. Configure providers

Add the config from `references/provider-config.yaml` to `~/.sig/config.yaml` under `providers:`.

### 2. Login

```bash
sig login douyin        # Opens browser, scan QR code with Douyin app
sig login douyin-live   # Same — captures live.douyin.com cookies
```

### 3. Verify

```bash
sig status douyin
sig status douyin-live
# Both should show: valid: true
```

## Usage

### Get cookies

```bash
# www.douyin.com cookie (for scraping)
sig get douyin --no-redaction --format value

# live.douyin.com cookie (for livestream)
sig get douyin-live --no-redaction --format value
```

### Export for tools (e.g. DouYin_Spider)

```bash
export DY_COOKIES=$(sig get douyin --no-redaction --format value)
export DY_LIVE_COOKIES=$(sig get douyin-live --no-redaction --format value)
```

### Write to .env file

```bash
echo "DY_COOKIES='$(sig get douyin --no-redaction --format value)'" > .env
echo "DY_LIVE_COOKIES='$(sig get douyin-live --no-redaction --format value)'" >> .env
```

## Validation

The `validateRule` uses Douyin's notification count API:

- Endpoint: `https://www.douyin.com/aweme/v1/web/notice/count/`
- Logged in: `{"status_code": 0, "notice_count": [...]}`
- Not logged in: `{"status_code": 8, "status_msg": "用户未登录"}`
- Rule: `res.body.status_code === 0`

## Notes

- Douyin requires visible browser login (QR code scan) — `loginMode: visible`
- Cookies from `.douyin.com` parent domain are shared between www and live subdomains
- TTL is set to 2h; use `sig watch add douyin` for auto-refresh
