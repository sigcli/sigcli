---
name: douban
description: 'Interact with Douban (douban.com) — search movies/books/music, read reviews, view ratings, browse Top 250, check user profiles. Use this skill whenever the user mentions Douban, 豆瓣, douban.com, wants to look up movie/book/music ratings, read Douban reviews, search Douban content, check Douban Top 250, or browse Douban user profiles. Also trigger when the user pastes a Douban URL or asks about Chinese movie/book/music reviews and ratings.'
---

# Douban

Search, browse, and read Douban movies, books, music, reviews, and user profiles.

## Authentication

**No authentication is required.** All scripts use Douban's public Frodo mobile API and HTML scraping. No cookies, tokens, or `sig run` needed.

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

| Script             | Purpose                        | Auth |
| ------------------ | ------------------------------ | ---- |
| `douban_search.py` | Search movies/books/music      | None |
| `douban_movie.py`  | Movie detail + reviews         | None |
| `douban_book.py`   | Book detail + reviews          | None |
| `douban_music.py`  | Music/album detail             | None |
| `douban_hot.py`    | Hot/showing/coming soon movies | None |
| `douban_top250.py` | Top 250 movies (HTML scraping) | None |
| `douban_user.py`   | User profile                   | None |

### douban_search.py

```
--query TEXT          Search query (required)
--type TYPE           Content type: "movie" (default), "book", "music"
--limit N             Max results (default: 20)
```

### douban_movie.py

```
--id ID               Douban movie ID (required)
--include-reviews     Also fetch recent reviews (flag)
```

### douban_book.py

```
--id ID               Douban book ID (required)
--include-reviews     Also fetch recent reviews (flag)
```

### douban_music.py

```
--id ID               Douban music/album ID (required)
```

### douban_hot.py

```
--category CAT        Category: "hot" (default), "showing", "coming"
--limit N             Max results (default: 20)
```

### douban_top250.py

```
--page N              Page number (default: 1, 25 movies per page)
```

### douban_user.py

```
--uid UID             Douban user uid or numeric ID (required)
```

## Key Concepts

**Frodo API** -- Douban's mobile API at `frodo.douban.com/api/v2`. Requires an `apikey` query parameter and a mobile User-Agent header. All read operations are public.

**Movie IDs** -- Numeric IDs found in URLs like `movie.douban.com/subject/1292052/`. Get IDs from search results, then use with `douban_movie.py`.

**Top 250** -- Scraped from `movie.douban.com/top250`. Returns 25 movies per page with rank, title, rating, info, and quote.

**Content types** -- Search supports `movie`, `book`, and `music` types. Each type returns different fields in the result items.

**Reviews (interests)** -- Douban calls user reviews "interests". Use `--include-reviews` on movie/book scripts to fetch recent user ratings and comments.

## Error Handling

| Error    | Cause                         | Fix                |
| -------- | ----------------------------- | ------------------ |
| HTTP_404 | Item or user not found        | Check the ID / uid |
| HTTP_429 | Rate limited by API           | Wait and retry     |
| HTTP_400 | Invalid request parameters    | Check arguments    |
| ERROR    | Network or unexpected failure | Check connectivity |

## Workflow Examples

### Search for a movie

1. `python3 scripts/douban_search.py --query "肖申克的救赎" --type movie --limit 5`

### Get movie detail with reviews

1. `python3 scripts/douban_movie.py --id 1292052 --include-reviews`

### Browse hot movies

1. `python3 scripts/douban_hot.py --category hot --limit 10`

### Browse Top 250

1. `python3 scripts/douban_top250.py --page 1`

### Search for a book

1. `python3 scripts/douban_search.py --query "三体" --type book --limit 5`

### Get book detail

1. `python3 scripts/douban_book.py --id 2567698 --include-reviews`

### Look up a user

1. `python3 scripts/douban_user.py --uid ahbei`
