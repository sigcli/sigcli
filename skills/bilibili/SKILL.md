---
name: bilibili
description: 'Interact with Bilibili (B站) — browse trending videos, view video details, read comments, search videos and users, view user profiles, like, coin, and favorite videos. Use this skill whenever the user mentions Bilibili, B站, wants to browse Bilibili content, search Bilibili videos, read Bilibili comments, look up Bilibili users, or interact with Bilibili content. Also trigger when the user pastes a Bilibili URL (e.g. bilibili.com/video/BV...) or mentions a BV ID.'
---

# Bilibili

Browse trending videos, view video details, read comments, search content, view user profiles, and interact with Bilibili (B站).

## Authentication

**Read operations** work without authentication via Bilibili's public web API. No credentials needed.

**Write operations** (like, coin, favorite) require a **session cookie**. Use `sig run` to inject it:

```bash
sig run bilibili -- bash -c 'python3 scripts/bilibili_like.py --cookie "$SIG_BILIBILI_COOKIE" --aid 123456'
```

The default Signet provider is `bilibili`. The env var is `SIG_BILIBILI_COOKIE`.

If a write script returns auth error, re-authenticate:

```bash
sig login https://www.bilibili.com/
```

**Signet provider config:**

```yaml
bilibili:
    domains: ['www.bilibili.com', 'bilibili.com', 'api.bilibili.com']
    entryUrl: https://www.bilibili.com/
    strategy: cookie
    config:
        ttl: '7d'
        requiredCookies: ['SESSDATA', 'bili_jct']
```

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

### Read Operations

| Script                 | Purpose              | Auth     |
| ---------------------- | -------------------- | -------- |
| `bilibili_video.py`    | Video details by BV  | None     |
| `bilibili_hot.py`      | Hot/trending videos  | None     |
| `bilibili_popular.py`  | Popular videos       | None     |
| `bilibili_ranking.py`  | Ranking by category  | None     |
| `bilibili_search.py`   | Search videos/users  | None     |
| `bilibili_comments.py` | Video comments       | None     |
| `bilibili_user.py`     | User profile + vids  | None     |
| `bilibili_dynamic.py`  | Dynamic feed (动态)  | Required |
| `bilibili_me.py`       | Current user profile | Required |
| `bilibili_history.py`  | Watch history        | Required |
| `bilibili_subtitle.py` | Video subtitles      | None     |

### Write Operations

| Script                 | Purpose             | Auth     |
| ---------------------- | ------------------- | -------- |
| `bilibili_like.py`     | Like/unlike a video | Required |
| `bilibili_coin.py`     | Give coins to video | Required |
| `bilibili_favorite.py` | Favorite/unfavorite | Required |

### bilibili_video.py

```
--bvid ID             Video BV ID (e.g. BV1xx411c7mD) (required)
```

### bilibili_hot.py

```
--limit N             Max videos to return (default: 20)
--page N              Page number (default: 1)
```

### bilibili_popular.py

```
--limit N             Max videos to return (default: 20)
--page N              Page number (default: 1)
```

### bilibili_ranking.py

```
--category NAME       Category: all, anime, music, dance, game, tech, knowledge, life, food, animal, car, fashion, entertainment, movie, tv (default: all)
--limit N             Max videos to return (default: 20)
```

### bilibili_search.py

```
--keyword TEXT        Search keyword (required)
--type TYPE           Search type: video, user (default: video)
--page N              Page number (default: 1)
--limit N             Max results (default: 20)
```

### bilibili_comments.py

```
--bvid ID             Video BV ID (required)
--limit N             Max comments to return (default: 20)
--page N              Page number (default: 1)
```

### bilibili_user.py

```
--mid N               User mid (numeric ID) (required)
--include-videos      Include recent videos (flag)
```

### bilibili_dynamic.py

```
--cookie COOKIE       Bilibili session cookie (required)
--limit N             Max items to return (default: 20)
--offset TOKEN        Pagination offset from previous response
```

### bilibili_me.py

```
--cookie COOKIE       Bilibili session cookie (required)
```

### bilibili_history.py

```
--cookie COOKIE       Bilibili session cookie (required)
--limit N             Max items to return (default: 20)
--view-at N           Cursor from previous response for pagination
```

### bilibili_subtitle.py

```
--bvid ID             Video BV ID (required)
--lang CODE           Subtitle language code (e.g. zh-CN, en-US, ai-zh). Default: first available
--cookie COOKIE       Bilibili session cookie (may be needed for some videos)
```

### bilibili_like.py

```
--cookie COOKIE       Bilibili session cookie (required)
--aid N               Video aid (numeric ID) (required)
--undo                Unlike instead of like (flag)
```

### bilibili_coin.py

```
--cookie COOKIE       Bilibili session cookie (required)
--aid N               Video aid (numeric ID) (required)
--multiply N          Number of coins: 1 or 2 (default: 1)
```

### bilibili_favorite.py

```
--cookie COOKIE       Bilibili session cookie (required)
--aid N               Video aid (numeric ID) (required)
--folder-id N         Favorites folder ID (optional, defaults to first folder)
--undo                Remove from favorites instead of adding (flag)
```

## Safety

**Write operations are visible to the user's Bilibili account.** Like and favorite are reversible via `--undo`. Coins cannot be taken back once given.

**Always confirm with the user before calling `bilibili_coin.py`** since coins are a limited, non-refundable currency on Bilibili.

## Key Concepts

**BV IDs** — Bilibili videos are identified by BV IDs (e.g. `BV1xx411c7mD`). Most read scripts accept BV IDs directly.

**AIDs** — Numeric video IDs used by write operations. Get the `aid` from video details (`bilibili_video.py`).

**WBI Signing** — Search and user profile endpoints require WBI parameter signing. The client handles this automatically.

**CSRF Token** — Write operations need a `bili_jct` CSRF token extracted from the session cookie. The client extracts it automatically.

**Categories** — Ranking supports categories: all (0), anime (1), music (3), dance (129), game (4), tech (188), knowledge (36), life (160), food (211), animal (217), car (223), fashion (155), entertainment (5), movie (181), tv (177).

**Pagination** — List endpoints accept `--page` for page number and `--limit` for page size.

## Error Handling

| Error         | Cause                        | Fix                                 |
| ------------- | ---------------------------- | ----------------------------------- |
| HTTP_412      | Request blocked by anti-spam | Wait and retry, or use different IP |
| HTTP_404      | Video/user not found         | Check the ID is correct             |
| AUTH_REQUIRED | No cookie for write op       | Run `sig login` and retry           |
| NO_CSRF       | No bili_jct in cookie        | Re-authenticate via `sig login`     |
| API_ERROR     | Bilibili returned error code | Check error message for details     |

## Workflow Examples

### Browse hot videos

1. `python3 scripts/bilibili_hot.py --limit 10`
2. Next page: `python3 scripts/bilibili_hot.py --limit 10 --page 2`

### Get video details

1. `python3 scripts/bilibili_video.py --bvid BV1xx411c7mD`

### Search for videos

1. `python3 scripts/bilibili_search.py --keyword "machine learning" --limit 10`

### Search for users

1. `python3 scripts/bilibili_search.py --keyword "username" --type user`

### Read video comments

1. `python3 scripts/bilibili_comments.py --bvid BV1xx411c7mD --limit 20`

### View ranking

1. `python3 scripts/bilibili_ranking.py --category music --limit 10`

### Like a video

1. Get the aid: `python3 scripts/bilibili_video.py --bvid BV1xx411c7mD` (check the `aid` field)
2. `sig run bilibili -- bash -c 'python3 scripts/bilibili_like.py --cookie "$SIG_BILIBILI_COOKIE" --aid 123456'`

### Give coins

1. **Confirm with user first — coins are non-refundable**
2. `sig run bilibili -- bash -c 'python3 scripts/bilibili_coin.py --cookie "$SIG_BILIBILI_COOKIE" --aid 123456 --multiply 1'`

### Add to favorites

1. `sig run bilibili -- bash -c 'python3 scripts/bilibili_favorite.py --cookie "$SIG_BILIBILI_COOKIE" --aid 123456 --folder-id 100'`

### View my profile

1. `sig run bilibili -- bash -c 'python3 scripts/bilibili_me.py --cookie "$SIG_BILIBILI_COOKIE"'`

### Browse dynamic feed

1. `sig run bilibili -- bash -c 'python3 scripts/bilibili_dynamic.py --cookie "$SIG_BILIBILI_COOKIE" --limit 10'`
2. Next page: `sig run bilibili -- bash -c 'python3 scripts/bilibili_dynamic.py --cookie "$SIG_BILIBILI_COOKIE" --offset TOKEN'`

### View watch history

1. `sig run bilibili -- bash -c 'python3 scripts/bilibili_history.py --cookie "$SIG_BILIBILI_COOKIE" --limit 20'`

### Get video subtitles

1. `python3 scripts/bilibili_subtitle.py --bvid BV1xx411c7mD`
2. Choose language: `python3 scripts/bilibili_subtitle.py --bvid BV1xx411c7mD --lang en-US`
