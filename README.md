# Sigcli

`sig` is a CLI powered by the SigCLI auth engine. Authenticate via browser SSO, store tokens, and make authenticated requests to any web service.

```bash
npm install -g @sigcli/cli
```

```bash
sig init                              # Create config (interactive, detects browser)
sig login https://jira.example.com    # Authenticate via browser SSO
sig get jira                          # Get credentials as JSON
sig request https://jira.example.com/rest/api/2/myself   # Authenticated request
```

**Pluggable strategies** — cookie, OAuth2, API token, basic auth. **Browser adapters** — Playwright with headless-to-visible fallback. **Credential sync** — push/pull over SSH for headless machines. **Watch mode** — auto-refresh expiring credentials on a schedule.

## Table of Contents

- [Commands](#commands)
- [Configuration](#configuration)
- [Strategies](#strategies)
- [xHeaders](#xheaders)
- [localStorage](#localstorage)
- [Remote / Headless Setup](#remote--headless-setup)
- [SDK](#sdk)
- [AI Agent Integration](#ai-agent-integration)
- [Packages](#packages)
- [Development](#development)

## Commands

### Setup

| Command                     | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `sig init`                  | Interactive setup -- creates `~/.sig/config.yaml`               |
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

All config lives in `~/.sig/config.yaml`. No env vars, no cascading, no project-local overrides. Run `sig init` to generate it.

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
    browserDataDir: ~/.sig/browser-data
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
    credentialsDir: ~/.sig/credentials
```

### `providers`

Provider entries map domains to authentication strategies. Most services work with zero config -- `sig login <url>` auto-provisions a cookie provider.

Define providers explicitly for OAuth2, API tokens, custom settings, or xHeaders.

**Common fields:**

| Field          | Required | Description                                                                |
| -------------- | -------- | -------------------------------------------------------------------------- |
| `domains`      | **yes**  | Array of domains for URL-to-provider resolution                            |
| `entryUrl`     | **yes**  | URL to navigate to for browser auth                                        |
| `strategy`     | **yes**  | `cookie`, `oauth2`, `api-token`, or `basic`                                |
| `name`         | no       | Display name (defaults to provider ID)                                     |
| `forceVisible` | no       | Skip headless, open visible browser immediately. Default: `false`          |
| `config`       | no       | Strategy-specific settings (see [Strategies](#strategies))                 |
| `xHeaders`     | no       | Extra headers to capture during auth (see [xHeaders](#xheaders))           |
| `localStorage` | no       | Browser localStorage values to extract (see [localStorage](#localstorage)) |

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

| Field    | Required | Default              | Description                  |
| -------- | -------- | -------------------- | ---------------------------- |
| `type`   | **yes**  | --                   | Only `ssh` supported         |
| `host`   | **yes**  | --                   | Remote hostname or IP        |
| `user`   | no       | current user         | SSH username                 |
| `path`   | no       | `~/.sig/credentials` | Remote credentials directory |
| `sshKey` | no       | system SSH config    | Path to SSH private key      |

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
    browserDataDir: ~/.sig/browser-data
    channel: chrome
    headlessTimeout: 30000
    visibleTimeout: 120000
    waitUntil: load

storage:
    credentialsDir: ~/.sig/credentials

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

    # IMPORTANT: entryUrl must point to a specific workspace (/client/<TEAM_ID>),
    # not the root URL, which shows a workspace picker where localStorage
    # is not yet populated.
    slack:
        domains: ['app.slack.com', 'edgeapi.slack.com']
        entryUrl: https://app.slack.com/client/<TEAM_ID>
        strategy: cookie
        config:
            ttl: '7d'
            requiredCookies: ['d']
        localStorage:
            - name: token
              key: localConfig_v2
              jsonPath: teams.<TEAM_ID>.token
```

## Strategies

### Strategy: `cookie`

For SSO-protected web apps. Opens a browser, waits for login, extracts cookies. This is the default -- most sites need no config.

| Config field      | Default | Description                                                              |
| ----------------- | ------- | ------------------------------------------------------------------------ |
| `ttl`             | `24h`   | Validity duration: `ms`, `s`, `m`, `h`, `d`                              |
| `waitUntil`       | `load`  | Page load condition: `load`, `networkidle`, `domcontentloaded`, `commit` |
| `requiredCookies` | --      | Cookie names that must exist before auth completes (e.g. QR code login)  |

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

## localStorage

Extract values from browser localStorage after authentication. Useful for apps that store tokens or session data in localStorage alongside cookies (e.g., Slack stores an `xoxc` token in localStorage).

Extracted values are stored on the credential and included in `sig get` JSON output, but are NOT applied as HTTP headers.

**Important:** The `entryUrl` must point to a page where localStorage is actually populated. For example, Slack's root URL shows a workspace picker — localStorage is only populated after entering a workspace. Use a direct workspace URL like `https://app.slack.com/client/<TEAM_ID>` instead.

| Field      | Required | Description                                                              |
| ---------- | -------- | ------------------------------------------------------------------------ |
| `name`     | **yes**  | Output key name for the extracted value                                  |
| `key`      | **yes**  | localStorage key to read                                                 |
| `jsonPath` | no       | Dot-delimited path into parsed JSON value (e.g. `teams.<TEAM_ID>.token`) |

```yaml
localStorage:
    - name: token
      key: localConfig_v2
      jsonPath: teams.<TEAM_ID>.token
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

## SDK

Use the SDK to consume SigCLI credentials programmatically — credentials never leave the process.

### TypeScript

```bash
npm install @sigcli/sdk
```

```typescript
import { SigClient } from '@sigcli/sdk';

const client = new SigClient();
const headers = await client.getHeaders('my-jira');
const res = await fetch('https://jira.example.com/rest/api/2/myself', { headers });
```

### Python

```bash
pip install sigcli-sdk
```

```python
from sigcli_sdk import SigClient

client = SigClient()
headers = client.get_headers("my-jira")
```

## AI Agent Integration

SigCLI works as an auth layer for AI coding agents (Claude Code, Cursor, Windsurf). Two approaches are available, with the SDK strongly recommended for security.

### Recommended: SigCLI SDK (credentials never leave the process)

```python
from sigcli_sdk import SigClient

client = SigClient()
headers = client.get_headers("my-jira")
response = requests.get("https://jira.example.com/rest/api/2/myself", headers=headers)
```

**Why:** Credentials stay inside the process. They never appear on stdout, in shell variables, in CLI args, or in the AI agent's context window -- eliminating the biggest credential leakage vector.

### Alternative: `sig request` (for simple one-off API calls)

```bash
sig request "https://jira.example.com/rest/api/2/issue/PROJ-123" --format body

sig request "https://jira.example.com/rest/api/2/issue" \
  --method POST \
  --header "Content-Type: application/json" \
  --body '{"fields": {"summary": "New issue"}}' \
  --format body
```

### Error handling

| Signal                      | Meaning         | Agent action             |
| --------------------------- | --------------- | ------------------------ |
| HTTP 401/403                | Session expired | `sig login <url>`, retry |
| HTML login page in response | SSO redirect    | `sig login <url>`, retry |
| `CredentialNotFoundError`   | No credential   | `sig login <url>`        |

## Packages

| Package                             | Path              | Registry                                                   |
| ----------------------------------- | ----------------- | ---------------------------------------------------------- |
| [CLI](cli/)                         | `cli/`            | [`@sigcli/cli`](https://www.npmjs.com/package/@sigcli/cli) |
| [SDK (TypeScript)](sdk/typescript/) | `sdk/typescript/` | [`@sigcli/sdk`](https://www.npmjs.com/package/@sigcli/sdk) |
| [SDK (Python)](sdk/python/)         | `sdk/python/`     | [`sigcli-sdk`](https://pypi.org/project/sigcli-sdk/)       |
| [Website](website/)                 | `website/`        | [sigcli.ai](https://sigcli.ai)                             |
| Skills                              | `skills/`         | —                                                          |

## Development

```bash
pnpm install
pnpm -r build
pnpm -r test
```

## License

[MIT](LICENSE)
