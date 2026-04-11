# Signet

General-purpose authentication CLI. Authenticate via browser SSO, store tokens, and make authenticated requests to any web service.

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Commands](#commands)
  - [Setup](#setup)
  - [Authentication](#authentication)
  - [Credentials](#credentials)
  - [Provider Management](#provider-management)
  - [Remote & Sync](#remote--sync)
  - [Watch](#watch)
  - [Global Flags](#global-flags)
- [Configuration](#configuration)
  - [mode](#mode)
  - [browser](#browser)
  - [storage](#storage)
  - [providers](#providers)
  - [remotes](#remotes)
  - [watch](#watch-1)
  - [Full Example](#full-example)
- [Strategies](#strategies)
  - [cookie](#strategy-cookie)
  - [oauth2](#strategy-oauth2)
  - [api-token](#strategy-api-token)
  - [basic](#strategy-basic)
- [xHeaders](#xheaders)
- [Remote / Headless Setup](#remote--headless-setup)
- [AI Agent Integration](#ai-agent-integration)

## Install

```bash
npm install -g signet-auth
```

Or from source:

```bash
git clone https://github.com/signet-auth/signet.git && cd signet
npm install && npm run build
```

## Quick Start

```bash
sig init                              # Create config (interactive, detects browser)
sig login https://jira.example.com    # Authenticate via browser SSO
sig get jira                          # Get credentials
sig request https://jira.example.com/rest/api/2/myself   # Authenticated request
```

## Commands

### Setup

| Command                     | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `sig init`                  | Interactive setup -- creates `~/.signet/config.yaml`            |
| `sig init --remote`         | Setup for headless machines (sets `mode: browserless`)          |
| `sig init --yes`            | Accept all defaults (non-interactive)                           |
| `sig init --force`          | Overwrite existing config                                       |
| `sig init --channel msedge` | Use a specific browser                                          |
| `sig doctor`                | Validate environment: config, directories, browser, credentials |

### Authentication

| Command                                         | Description                                  |
| ----------------------------------------------- | -------------------------------------------- |
| `sig login <url>`                               | Authenticate via browser SSO                 |
| `sig login <url> --as <id>`                     | Authenticate with a custom provider ID       |
| `sig login <url> --token <value>`               | Store an API key or PAT (no browser)         |
| `sig login <url> --cookie "k=v; k2=v2"`         | Store cookies from DevTools (no browser)     |
| `sig login <url> --username <u> --password <p>` | Basic auth (no browser)                      |
| `sig login <url> --strategy <name>`             | Force a specific strategy                    |
| `sig logout [provider]`                         | Clear credentials (all if no provider given) |

### Credentials

| Command                                                | Description                           |
| ------------------------------------------------------ | ------------------------------------- |
| `sig get <provider\|url>`                              | Get credential headers (JSON default) |
| `sig get <provider\|url> --format json\|header\|value` | Choose output format                  |
| `sig request <url>`                                    | Make authenticated HTTP request       |
| `sig request <url> --method POST --body '{...}'`       | POST with body                        |
| `sig request <url> --header "K: V" --format body`      | Add headers, get body only            |
| `sig status`                                           | Show auth status for all providers    |
| `sig status <provider> --format json\|table`           | Status for one provider               |

### Provider Management

| Command                               | Description                                        |
| ------------------------------------- | -------------------------------------------------- |
| `sig providers`                       | List all configured providers                      |
| `sig providers --format json\|table`  | Choose output format                               |
| `sig rename <old-id> <new-id>`        | Rename a provider (updates config + credentials)   |
| `sig remove <provider> [...]`         | Remove provider(s) -- deletes config + credentials |
| `sig remove <provider> --keep-config` | Clear credentials only, keep config entry          |

### Remote & Sync

| Command                                                 | Description                                 |
| ------------------------------------------------------- | ------------------------------------------- |
| `sig remote add <name> <host>`                          | Add an SSH remote                           |
| `sig remote add <name> <host> --user <u> --ssh-key <k>` | With options                                |
| `sig remote remove <name>`                              | Remove a remote                             |
| `sig remote list`                                       | List remotes                                |
| `sig sync push [remote]`                                | Push credentials to remote over SSH         |
| `sig sync pull [remote]`                                | Pull credentials from remote over SSH       |
| `sig sync push --provider <id> --force`                 | Push specific provider, overwrite conflicts |

### Watch

| Command                                         | Description                               |
| ----------------------------------------------- | ----------------------------------------- |
| `sig watch add <provider>`                      | Add provider to watch list                |
| `sig watch add <provider> --auto-sync <remote>` | Watch + auto-sync to remote after refresh |
| `sig watch remove <provider>`                   | Remove from watch list                    |
| `sig watch list`                                | Show watched providers                    |
| `sig watch start`                               | Start the watch daemon (Ctrl+C to stop)   |
| `sig watch start --once`                        | Single check cycle (for cron)             |
| `sig watch start --interval 1m`                 | Override check interval                   |
| `sig watch set-interval <duration>`             | Set default check interval                |

### Global Flags

| Flag        | Description             |
| ----------- | ----------------------- |
| `--verbose` | Debug logging to stderr |
| `--help`    | Show help               |

## Configuration

All config lives in `~/.signet/config.yaml`. No env vars, no cascading, no project-local overrides. Run `sig init` to generate it.

### `mode`

Controls whether browser automation is available.

| Value         | Description                                               |
| ------------- | --------------------------------------------------------- |
| `browser`     | Default. Browser available for SSO                        |
| `browserless` | No browser. Use `sig sync pull`, `--cookie`, or `--token` |

### `browser`

Browser automation settings for cookie and OAuth2 authentication.

| Field             | Required | Default  | Description                                                              |
| ----------------- | -------- | -------- | ------------------------------------------------------------------------ |
| `browserDataDir`  | **yes**  | --       | Persistent browser profile directory                                     |
| `channel`         | **yes**  | --       | `chrome`, `msedge`, or `chromium`                                        |
| `headlessTimeout` | no       | `30000`  | Timeout (ms) for headless auth attempt before falling back to visible    |
| `visibleTimeout`  | no       | `120000` | Timeout (ms) for visible/user-assisted auth                              |
| `waitUntil`       | no       | `load`   | Page load condition: `load`, `networkidle`, `domcontentloaded`, `commit` |

```yaml
browser:
  browserDataDir: ~/.signet/browser-data
  channel: chrome
  headlessTimeout: 30000
  visibleTimeout: 120000
  waitUntil: load
```

### `storage`

| Field            | Required | Description                                      |
| ---------------- | -------- | ------------------------------------------------ |
| `credentialsDir` | **yes**  | Directory for per-provider credential JSON files |

```yaml
storage:
  credentialsDir: ~/.signet/credentials
```

### `providers`

Provider entries map domains to authentication strategies. Most services work with zero config -- `sig login <url>` auto-provisions a cookie provider.

Define providers explicitly for OAuth2, API tokens, custom settings, or xHeaders.

**Common fields:**

| Field          | Required | Description                                                       |
| -------------- | -------- | ----------------------------------------------------------------- |
| `domains`      | **yes**  | Array of domains for URL-to-provider resolution                   |
| `entryUrl`     | **yes**  | URL to navigate to for browser auth                               |
| `strategy`     | **yes**  | `cookie`, `oauth2`, `api-token`, or `basic`                       |
| `name`         | no       | Display name (defaults to provider ID)                            |
| `forceVisible` | no       | Skip headless, open visible browser immediately. Default: `false` |
| `config`       | no       | Strategy-specific settings (see [Strategies](#strategies))        |
| `xHeaders`     | no       | Extra headers to capture during auth (see [xHeaders](#xheaders))  |

```yaml
providers:
  jira:
    domains: ['jira.example.com']
    entryUrl: https://jira.example.com/
    strategy: cookie
    config:
      ttl: '10d'
```

### `remotes`

SSH remotes for syncing credentials to other machines.

| Field    | Required | Default                 | Description                  |
| -------- | -------- | ----------------------- | ---------------------------- |
| `type`   | **yes**  | --                      | Only `ssh` supported         |
| `host`   | **yes**  | --                      | Remote hostname or IP        |
| `user`   | no       | current user            | SSH username                 |
| `path`   | no       | `~/.signet/credentials` | Remote credentials directory |
| `sshKey` | no       | system SSH config       | Path to SSH private key      |

```yaml
remotes:
  dev-server:
    type: ssh
    host: dev.example.com
    user: deploy
```

### `watch`

Managed by `sig watch add/remove/set-interval`. Defines which providers are monitored.

| Field                     | Required | Description                           |
| ------------------------- | -------- | ------------------------------------- |
| `interval`                | **yes**  | Check interval: `30s`, `5m`, `1h`     |
| `providers`               | **yes**  | Map of provider IDs to watch options  |
| `providers.<id>.autoSync` | no       | Remote names to sync to after refresh |

```yaml
watch:
  interval: '5m'
  providers:
    jira:
      autoSync:
        - dev-server
    wiki: # watch + refresh only, no auto-sync
```

### Full Example

```yaml
mode: browser

browser:
  browserDataDir: ~/.signet/browser-data
  channel: chrome
  headlessTimeout: 30000
  visibleTimeout: 120000
  waitUntil: load

storage:
  credentialsDir: ~/.signet/credentials

remotes:
  dev-server:
    type: ssh
    host: dev.example.com
    user: deploy

watch:
  interval: '5m'
  providers:
    jira:
      autoSync:
        - dev-server
    ms-teams:

providers:
  jira:
    domains: ['jira.example.com']
    entryUrl: https://jira.example.com/
    strategy: cookie
    config:
      ttl: '10d'

  github:
    domains: ['github.com', 'api.github.com']
    entryUrl: https://github.com/
    strategy: api-token
    config:
      setupInstructions: 'Create a PAT at https://github.com/settings/tokens'

  ms-teams:
    domains: ['teams.cloud.microsoft']
    entryUrl: https://teams.cloud.microsoft/v2/
    strategy: oauth2
    config:
      audiences: ['https://ic3.teams.office.com']
```

## Strategies

### Strategy: `cookie`

For SSO-protected web apps. Opens a browser, waits for login, extracts cookies. This is the default -- most sites need no config.

| Config field      | Default | Description                                                             |
| ----------------- | ------- | ----------------------------------------------------------------------- |
| `ttl`             | `24h`   | Validity duration: `ms`, `s`, `m`, `h`, `d`                             |
| `requiredCookies` | --      | Cookie names that must exist before auth completes (e.g. QR code login) |

### Strategy: `oauth2`

For APIs using OAuth2/JWT tokens. Opens a browser for OAuth consent, extracts tokens from localStorage.

| Config field    | Description                                |
| --------------- | ------------------------------------------ |
| `audiences`     | Filter tokens by audience claim            |
| `tokenEndpoint` | Token endpoint URL for refresh_token grant |
| `clientId`      | OAuth2 client ID for refresh_token grant   |
| `scopes`        | OAuth2 scopes for refresh_token grant      |

### Strategy: `api-token`

For static API keys or PATs. No browser needed.

| Config field        | Default         | Description                                           |
| ------------------- | --------------- | ----------------------------------------------------- |
| `headerName`        | `Authorization` | HTTP header name                                      |
| `headerPrefix`      | `Bearer`        | Prefix before the token value (empty string for none) |
| `setupInstructions` | --              | Instructions shown when a token is needed             |

### Strategy: `basic`

For username/password auth. No browser needed.

| Config field        | Description                                    |
| ------------------- | ---------------------------------------------- |
| `setupInstructions` | Instructions shown when credentials are needed |

## xHeaders

Capture extra HTTP headers during browser auth. Useful for CSRF tokens, anti-bot signatures, or custom headers set by web apps.

Captured headers are stored on the credential and applied automatically by `sig get` and `sig request`.

| Field         | Required | Description                                                     |
| ------------- | -------- | --------------------------------------------------------------- |
| `name`        | **yes**  | Header name to capture (case-insensitive)                       |
| `source`      | no       | `request` or `response` (default: both)                         |
| `urlPattern`  | no       | Only capture from URLs matching this substring                  |
| `staticValue` | no       | Fixed value instead of capturing. Ignores `source`/`urlPattern` |

```yaml
xHeaders:
  - name: x-csrf-token
    source: request
    urlPattern: app.example.com/api
  - name: origin
    staticValue: https://app.example.com
```

## Remote / Headless Setup

For machines without a browser (remote servers, CI, containers).

**On the remote machine:**

```bash
sig init --remote       # Sets mode: browserless
```

**Get credentials (pick one):**

```bash
# Option 1: Sync from a machine with a browser
sig remote add laptop laptop.local
sig sync pull laptop

# Option 2: Paste cookies from browser DevTools
sig login https://jira.example.com --cookie "session=abc123; token=xyz"

# Option 3: API token
sig login https://api.example.com --token ghp_xxxxxxxxxxxxx
```

## AI Agent Integration

Signet works as an auth layer for AI coding agents (Claude Code, Cursor, Windsurf). The agent shells out to `sig` -- no SDK or MCP server needed.

**Flow:** Human authenticates via browser SSO once. Agent reuses credentials via `sig get` / `sig request`. On 401/403, agent triggers `sig login <url>` for the human.

### Direct requests

```bash
sig request "https://jira.example.com/rest/api/2/issue/PROJ-123" --format body

sig request "https://jira.example.com/rest/api/2/issue" \
  --method POST \
  --header "Content-Type: application/json" \
  --body '{"fields": {"summary": "New issue"}}' \
  --format body
```

### Credential pass-through

```bash
CRED=$(sig get https://wiki.example.com/ --format value)
python scripts/wiki_search.py --cookie "$CRED"

TOKEN=$(sig get https://graph.microsoft.com/ --format value | sed 's/^Bearer //')
python scripts/calendar.py --token "$TOKEN"
```

### Curl fallback

For multipart uploads or requests `sig request` can't handle:

```bash
CRED=$(sig get https://jira.example.com/ --format value)
curl -X POST "https://jira.example.com/rest/api/2/issue/PROJ-123/attachments" \
  -H "Cookie: $CRED" \
  -H "X-Atlassian-Token: no-check" \
  -F "file=@/path/to/file.png"
```

### Error handling

| Signal                      | Meaning         | Agent action             |
| --------------------------- | --------------- | ------------------------ |
| HTTP 401/403                | Session expired | `sig login <url>`, retry |
| HTML login page in response | SSO redirect    | `sig login <url>`, retry |
| `sig get` returns empty     | No credential   | `sig login <url>`        |

### Claude Code skill setup

Create a [skill](https://docs.anthropic.com/en/docs/claude-code/skills) with a `SKILL.md`:

```markdown
---
name: my-api
description: 'Interact with My API. Trigger on: my-api, tickets, issues...'
---

## Authentication

Get credential: `CRED=$(sig get https://api.example.com/ --format value)`
Re-auth: `sig login https://api.example.com/`

## Endpoints

| Operation  | Command                                                     |
| ---------- | ----------------------------------------------------------- |
| List items | `sig request "https://api.example.com/items" --format body` |
```

## License

[MIT](LICENSE)
