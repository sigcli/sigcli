# Signet

General-purpose authentication CLI. Manages credentials for any web service -- authenticate via browser SSO, store tokens, and make authenticated requests.

## Install

```bash
npm install -g signet-auth
sig init
```

That's it. `sig init` auto-detects your browser and creates `~/.signet/config.yaml` with sensible defaults.

### From source

```bash
git clone <repo-url> && cd signet
npm install
npm run build
```

The CLI is available as `sig` (or `./bin/sig.js`).

## Quick Start

```bash
sig init                              # Create config (interactive)
sig login https://jira.example.com    # Authenticate via browser SSO
sig get jira                          # Get credentials for scripts/tools
sig request https://jira.example.com/rest/api/2/myself   # Authenticated request
sig doctor                            # Check your setup
```

## Commands

### `init` -- Set up Signet

```bash
sig init                # Interactive setup (detects browser, offers provider templates)
sig init --yes          # Accept all defaults (non-interactive)
sig init --remote       # Headless/remote machine setup (browser disabled)
sig init --force        # Overwrite existing config
sig init --channel msedge --yes   # Use Edge instead of Chrome
```

Creates `~/.signet/config.yaml`, `~/.signet/credentials/`, and `~/.signet/browser-data/`. Detects your installed browser and generates a commented config file.

Use `--remote` on machines without a browser (e.g., remote Linux dev servers). This sets `mode: browserless` and guides you to get credentials via `sig sync pull` or manual `--cookie`/`--token` flags.

### `doctor` -- Check your setup

```bash
sig doctor
```

Validates your environment: config file, directories, browser availability, Node.js version, stored credentials.

```
  ✓ Config file exists (~/.signet/config.yaml)
  ✓ Config is valid
  ✓ Credentials directory exists (~/.signet/credentials)
  ✓ Browser data directory exists (~/.signet/browser-data)
  ✓ Browser available (chrome)
  ✓ Node.js version (v22.16.0)
  ✓ Stored credentials (2 stored credentials)

All checks passed.
```

### `login` -- Authenticate with a service

```bash
sig login <url>
sig login <url> --token <value>
sig login <url> --cookie "name=value; name2=value2"
sig login <url> --username <user> --password <pass>
sig login <url> --strategy <cookie|oauth2|api-token|basic>
```

Opens a browser for SSO login by default. Use `--token` to store an API key, `--cookie` to set cookies from browser DevTools, or `--username`/`--password` for basic auth -- all without a browser.

### `get` -- Retrieve credentials

```bash
sig get <provider|url>
sig get <provider|url> --format json|header|value
```

Returns stored credentials as JSON (default), raw headers, or just the value.

### `request` -- Make authenticated HTTP requests

```bash
sig request <url>
sig request <url> --method POST --body '{"key":"value"}'
sig request <url> --header "X-Custom: value" --format body
```

Injects credentials automatically. Supports `GET`, `POST`, `PUT`, `PATCH`. Output as full JSON response (default), body only, or headers only.

### `status` -- Check authentication status

```bash
sig status
sig status <provider>
sig status --format json|table
```

Shows which providers are authenticated, credential types, and expiry.

### `logout` -- Clear credentials

```bash
sig logout [provider]
```

Clears credentials for a specific provider, or all providers if none specified.

### `providers` -- List configured providers

```bash
sig providers
sig providers --format json|table
```

### `remote` -- Manage remote credential stores

```bash
sig remote add <name> <host> [--user <user>] [--path <path>] [--ssh-key <key>]
sig remote remove <name>
sig remote list
```

Configure SSH remotes for credential synchronization.

### `sync` -- Sync credentials with remotes

```bash
sig sync push [remote] [--provider <id>] [--force]
sig sync pull [remote] [--provider <id>] [--force]
```

Push or pull credentials to/from remote machines over SSH. Use `--force` to overwrite on conflict.

## Configuration

All configuration lives in a single file: `~/.signet/config.yaml`. No env vars, no cascading, no project-local overrides.

Run `sig init` to generate a config interactively, or copy `config/config.example.yaml` to `~/.signet/config.yaml`.

### `mode`

Controls whether browser automation is available. Values: `browser` (default), `browserless`.

Use `sig init --remote` to generate a config with `mode: browserless`.

```yaml
mode: browserless # remote/headless machine — no browser available
```

When `browserless`, browser-based strategies (cookie, oauth2) will not attempt to launch a browser. Use `sig sync pull`, `--cookie`, or `--token` to get credentials instead.

### `browser` (required)

Controls the browser used for SSO authentication.

| Field             | Required | Default | Description                                                                                                                                                                                   |
| ----------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browserDataDir`  | **yes**  | --      | Directory for persistent browser profile (cookies, localStorage). Example: `~/.signet/browser-data`                                                                                           |
| `channel`         | **yes**  | --      | Browser channel. Values: `chrome`, `msedge`, `chromium`                                                                                                                                       |
| `headlessTimeout` | **yes**  | --      | Timeout in ms for headless auth attempt. Headless is tried first; if it times out, falls back to visible mode. Recommended: `15000`-`30000`                                                   |
| `visibleTimeout`  | **yes**  | --      | Timeout in ms for visible (user-assisted) auth. Must be long enough for the user to complete SSO manually. Recommended: `60000`-`120000`                                                      |
| `waitUntil`       | **yes**  | --      | Page load condition before checking auth status. Values: `load` (DOM loaded), `networkidle` (no network activity for 500ms), `domcontentloaded` (HTML parsed), `commit` (first byte received) |

```yaml
browser:
  browserDataDir: ~/.signet/browser-data
  channel: chrome
  headlessTimeout: 15000
  visibleTimeout: 60000
  waitUntil: load
```

### `storage` (required)

Where credentials are stored on disk.

| Field            | Required | Description                                                                        |
| ---------------- | -------- | ---------------------------------------------------------------------------------- |
| `credentialsDir` | **yes**  | Directory for per-provider credential JSON files. Example: `~/.signet/credentials` |

```yaml
storage:
  credentialsDir: ~/.signet/credentials
```

### `remotes` (optional)

SSH remotes for syncing credentials to other machines.

| Field    | Required | Description                                                       |
| -------- | -------- | ----------------------------------------------------------------- |
| `type`   | **yes**  | Transport type. Only `ssh` is supported                           |
| `host`   | **yes**  | Remote hostname or IP                                             |
| `user`   | no       | SSH username. Defaults to current user                            |
| `path`   | no       | Remote credentials directory. Defaults to `~/.signet/credentials` |
| `sshKey` | no       | Path to SSH private key. Defaults to system SSH config            |

```yaml
remotes:
  dev-server:
    type: ssh
    host: dev.example.com
    user: deploy
```

### `providers` (optional)

Provider entries map domains to authentication strategies. The key is the provider ID.

Most services work with zero config -- just run `sig login <url>` and it auto-provisions a cookie provider. Define providers explicitly for OAuth2, API tokens, or when you need custom settings.

#### Common provider fields

| Field          | Required | Description                                                                                                                                             |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domains`      | **yes**  | Array of domains this provider handles. Used for URL-to-provider resolution. Example: `["jira.example.com"]`                                            |
| `strategy`     | **yes**  | Authentication strategy. Values: `cookie`, `oauth2`, `api-token`, `basic`                                                                               |
| `name`         | no       | Display name. Defaults to the provider ID                                                                                                               |
| `entryUrl`     | no       | URL to navigate to for browser-based auth. Required for `cookie` and `oauth2` strategies                                                                |
| `forceVisible` | no       | `true` to skip headless attempt and open visible browser immediately. Use for sites requiring CAPTCHAs, QR codes, or interactive auth. Default: `false` |
| `config`       | no       | Strategy-specific settings (see below)                                                                                                                  |
| `xHeaders`     | no       | Extra HTTP headers to capture during browser auth (see [xHeaders](#xheaders))                                                                           |

#### Strategy: `cookie`

For SSO-protected web apps. Opens a browser, waits for login, extracts cookies. This is the default strategy -- most sites need no config at all.

| Config field      | Required | Default | Description                                                                                                                                                                        |
| ----------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ttl`             | no       | `24h`   | How long cookies are considered valid before re-authentication. Duration string: `ms`, `s`, `m`, `h`, `d`. Examples: `30m`, `12h`, `7d`                                            |
| `requiredCookies` | no       | --      | Cookie names that must exist before auth is considered complete. Use for sites where the entry page isn't a login page (e.g. QR code login). Example: `["session_id", "id_token"]` |

```yaml
providers:
  jira:
    domains: ["jira.example.com"]
    strategy: cookie
    config:
      ttl: "10d"
```

Minimal (uses all defaults):

```yaml
providers:
  jira:
    domains: ["jira.example.com"]
    strategy: cookie
```

#### Strategy: `oauth2`

For APIs using OAuth2/JWT tokens. Opens a browser for the OAuth consent flow, extracts tokens from browser localStorage.

| Config field    | Required | Default | Description                                                                                                                     |
| --------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `audiences`     | no       | --      | Filter tokens by audience claim. Only tokens matching these audiences are extracted. Example: `["https://graph.microsoft.com"]` |
| `tokenEndpoint` | no       | --      | Token endpoint URL for refresh_token grant. Required if you want automatic token refresh                                        |
| `clientId`      | no       | --      | OAuth2 client ID for refresh_token grant. Required with `tokenEndpoint`                                                         |
| `scopes`        | no       | --      | OAuth2 scopes for refresh_token grant. Example: `["openid", "profile", "User.Read"]`                                            |

```yaml
providers:
  ms-teams:
    name: Microsoft Teams
    domains: ["teams.cloud.microsoft"]
    entryUrl: https://teams.cloud.microsoft/v2/
    strategy: oauth2
    config:
      audiences: ["https://ic3.teams.office.com"]
```

#### Strategy: `api-token`

For static API keys or personal access tokens. No browser needed -- prompts the user to enter a token.

| Config field        | Required | Default         | Description                                                                |
| ------------------- | -------- | --------------- | -------------------------------------------------------------------------- |
| `headerName`        | no       | `Authorization` | HTTP header name to place the token in                                     |
| `headerPrefix`      | no       | `Bearer`        | Prefix before the token value. Set to empty string for no prefix           |
| `setupInstructions` | no       | --              | Instructions shown to the user when a token is needed. Supports multi-line |

```yaml
providers:
  github:
    name: GitHub
    domains: ["github.com", "api.github.com"]
    strategy: api-token
    config:
      headerName: Authorization
      headerPrefix: Bearer
      setupInstructions: |
        Create a Personal Access Token at:
        https://github.com/settings/tokens
```

#### Strategy: `basic`

For username/password authentication. No browser needed -- prompts the user for credentials.

| Config field        | Required | Default | Description                                                |
| ------------------- | -------- | ------- | ---------------------------------------------------------- |
| `setupInstructions` | no       | --      | Instructions shown to the user when credentials are needed |

```yaml
providers:
  legacy-api:
    domains: ["api.internal.corp"]
    strategy: basic
    config:
      setupInstructions: "Contact IT for credentials."
```

#### xHeaders

Capture extra HTTP headers during browser authentication. Useful for APIs that require anti-bot signatures, CSRF tokens, or custom headers that are set dynamically by the web app.

Captured headers are stored alongside the credential and applied automatically on `sig get` and `sig request`.

| Field         | Required | Description                                                                                         |
| ------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `name`        | **yes**  | HTTP header name to capture (case-insensitive match)                                                |
| `source`      | no       | Where to capture from: `request` or `response`. Default: both                                       |
| `urlPattern`  | no       | Only capture from URLs matching this substring                                                      |
| `staticValue` | no       | Use a fixed value instead of capturing dynamically. When set, `source` and `urlPattern` are ignored |

```yaml
providers:
  my-app:
    domains: ["app.example.com"]
    entryUrl: https://app.example.com/
    strategy: cookie
    forceVisible: true
    config:
      requiredCookies: ["id_token"]
    xHeaders:
      - name: x-csrf-token
        source: request
        urlPattern: app.example.com/api
      - name: origin
        staticValue: https://app.example.com
      - name: referer
        staticValue: https://app.example.com/
```

### Full example

```yaml
browser:
  browserDataDir: ~/.signet/browser-data
  channel: chrome
  headlessTimeout: 15000
  visibleTimeout: 60000
  waitUntil: load

storage:
  credentialsDir: ~/.signet/credentials

remotes:
  dev-server:
    type: ssh
    host: dev.example.com
    user: deploy

providers:
  jira:
    domains: ["jira.example.com"]
    strategy: cookie
    config:
      ttl: "10d"

  github:
    domains: ["github.com", "api.github.com"]
    strategy: api-token
    config:
      setupInstructions: "Create a PAT at https://github.com/settings/tokens"

  ms-teams:
    domains: ["teams.cloud.microsoft"]
    entryUrl: https://teams.cloud.microsoft/v2/
    strategy: oauth2
    config:
      audiences: ["https://ic3.teams.office.com"]
```

## Remote / Headless Setup

On machines without a browser (remote Linux servers, CI, containers), use `--remote` during init:

**Local machine (has browser):**

```bash
sig init                              # Detects browser, interactive setup
sig login https://jira.example.com    # Opens browser for SSO
sig get jira                          # Credentials ready
```

**Remote machine (no browser):**

```bash
sig init --remote                     # Sets browser.enabled: false
```

Then get credentials using one of:

```bash
# Option 1: Sync from a machine with a browser
sig remote add laptop laptop.local    # Point to machine where you logged in
sig sync pull laptop                  # Pull credentials over SSH

# Option 2: Set cookies manually (copy from browser DevTools)
sig login https://jira.example.com --cookie "session=abc123; token=xyz"

# Option 3: Set an API token
sig login https://api.example.com --token ghp_xxxxxxxxxxxxx
```

## Authentication Strategies

| Strategy      | When to use                      | Browser needed |
| ------------- | -------------------------------- | -------------- |
| **cookie**    | SSO-protected web apps (default) | Yes            |
| **oauth2**    | APIs with OAuth2/JWT tokens      | Yes            |
| **api-token** | Static API keys or PATs          | No             |
| **basic**     | Username/password auth           | No             |

Cookie-based auth is the default -- just `sig login <url>` and complete SSO in the browser window.

## License

[MIT](LICENSE)
