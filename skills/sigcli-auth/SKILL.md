# sigcli-auth Skill

Operate sigcli to authenticate with any web service from the CLI. This guide is written for AI agents (Claude Code, Cursor) that need to obtain, check, and use auth credentials programmatically.

## Overview

sigcli (`sig`) is a CLI tool that stores and manages authentication credentials for web services. It uses a declarative extract/apply model: `extract[]` rules define what to capture from the browser (cookies, localStorage, eval), and `apply[]` rules define how to inject credentials into HTTP requests. Credentials are encrypted at rest (AES-256-GCM) and stored locally (`~/.sig/`).

**Binary:** `sig`  
**Config:** `~/.sig/config.yaml`  
**Credentials:** `~/.sig/credentials/<provider-id>.json` (encrypted, AES-256-GCM)  
**Encryption key:** `~/.sig/encryption.key`

---

## Available Commands

| Command                          | Description                                      | When to Use                                     | Typical Latency                   |
| -------------------------------- | ------------------------------------------------ | ----------------------------------------------- | --------------------------------- |
| `sig init`                       | Create/initialize config                         | First-time setup                                | < 1s                              |
| `sig init --remote`              | Set up for headless/remote machine               | No display available                            | < 1s                              |
| `sig doctor`                     | Validate environment, config, and encryption key | Troubleshoot setup issues                       | 1-3s                              |
| `sig login <provider\|url>`      | Authenticate with a service                      | No stored credentials, or expired               | 30-120s (browser) / < 1s (prompt) |
| `sig logout [provider]`          | Clear stored credentials                         | Reset auth state                                | < 1s                              |
| `sig get <provider\|url>`        | Retrieve credential headers                      | Get headers for curl or scripts                 | < 1s                              |
| `sig request <url>`              | Make authenticated HTTP request                  | Test an endpoint with auth applied              | 1-5s                              |
| `sig status [provider]`          | Show auth status for all/one provider            | Check if logged in before acting                | 1-3s                              |
| `sig providers`                  | List configured providers                        | Discover what is configured                     | 1-3s                              |
| `sig rename <old> <new>`         | Rename a provider                                | Reorganize providers                            | < 1s                              |
| `sig remove <provider> [...]`    | Delete provider(s) and credentials               | Clean up                                        | < 1s                              |
| `sig remote add <name> <host>`   | Add SSH remote for credential sync               | Set up headless machine sync                    | < 1s                              |
| `sig remote remove <name>`       | Remove SSH remote                                | Clean up                                        | < 1s                              |
| `sig remote list`                | List configured remotes                          | Inspect sync targets                            | < 1s                              |
| `sig sync push\|pull [remote]`   | Sync credentials over SSH                        | Share credentials with headless machines        | 5-30s                             |
| `sig watch add <provider>`       | Add provider to auto-refresh watch list          | Keep long-lived sessions alive                  | < 1s                              |
| `sig watch remove <provider>`    | Remove from watch list                           | Stop auto-refresh                               | < 1s                              |
| `sig watch set-interval <dur>`   | Set default watch interval                       | Tune refresh frequency                          | < 1s                              |
| `sig proxy start [--port N]`     | Start MITM proxy daemon                          | Daemons/tools that read HTTP_PROXY env vars     | < 1s (daemon runs in background)  |
| `sig proxy stop`                 | Stop proxy daemon                                | Shut down proxy                                 | < 1s                              |
| `sig proxy status`               | Show proxy running state and port                | Check if proxy is running                       | < 1s                              |
| `sig proxy trust`                | Print CA cert path + OS trust instructions       | First-time proxy setup                          | < 1s                              |
| `sig run [provider...] -- <cmd>` | Run command with credentials in env              | Scripts that need SIG\_<PROVIDER\>\_\* env vars | < 1s + child process              |

---

## Architecture: Extract + Apply Model

SigCLI uses a declarative configuration model:

```
sig login <url>
  → Strategy (browser | prompt) runs extract[] rules
  → Credentials stored as flat key-value map (encrypted)

sig get / sig request / sig run / sig proxy
  → Load stored credentials
  → Apply apply[] rules (template interpolation)
  → Inject into HTTP headers/body/query
```

### Strategies

| Strategy  | `needsBrowser` | How it works                                                        |
| --------- | -------------- | ------------------------------------------------------------------- |
| `browser` | yes            | Headless → CDP → visible cascade. Polls extract[] rules until done. |
| `prompt`  | no             | Asks user interactively for each extract[] rule value.              |

### Extract Rules

Each rule captures one credential value:

```yaml
extract:
    - from: cookies | localStorage | eval | prompt
      as: <output-key> # Name for the extracted value
      match: <selector> # Cookie name pattern, localStorage key, or eval expression
      jsonPath: <path> # Optional: dot-path into JSON value (e.g. "teams.T123.token")
      expiresJsonPath: <path> # Optional: dot-path to expiration timestamp
```

### Apply Rules

Each rule injects a credential into HTTP requests:

```yaml
apply:
    - in: header | body | query
      name: <field-name> # Header name, body field, or query param
      value: <template> # Template with ${key} interpolation (e.g. "Bearer ${token}")
      action: set | append | remove # Default: set
```

Template interpolation: `${key}` resolves to the extracted value with that `as` name.

### Required Fields

Optional completion criteria — auth is not considered done until these fields exist:

```yaml
required:
    - session.reddit_session # format: <as-name>.<cookie-name-or-subfield>
    - xoxc-token # or just the as-name for non-cookie sources
```

---

## Login Decision Tree

```
Do you have credentials already?
|
+- YES: Has API key or token
|       → Configure strategy: prompt + extract from: prompt
|       → sig login <provider>  (will prompt for value)
|
+- NO: Must complete SSO/OAuth in a browser
        |
        +- Machine HAS a display (developer laptop)
        |   → sig login <url>                     # 30-120s, opens browser
        |
        +- Machine is HEADLESS / CI / remote
            → sig sync pull                       # Pull creds from a machine that has them
              (requires: sig remote add first)
```

### Login flags

```bash
sig login <provider|url> [OPTIONS]

  --as <id>              # Custom provider ID for auto-provisioned providers
  --force                # Skip stored credentials, force re-authentication
  --network-proxy <url>  # Browser proxy (e.g. socks5h://127.0.0.1:1080)
```

---

## Common Patterns

### Check auth status before acting

Always check status first to avoid unnecessary browser launches:

```bash
sig status <provider> --format json
# Exit 0 + "valid": true  -> credentials ready, skip login
# Exit 3                  -> no credentials, run sig login
# Exit 0 + expired        -> run: sig logout <provider> && sig login <url>
```

### Run scripts with credentials injected (recommended)

Use `sig run` to inject credentials as `SIG_<PROVIDER>_*` environment variables. Output is automatically redacted.

```bash
# Run a script with credentials
sig run grafana -- python fetch_data.py

# Env vars injected (for provider "jira-tools", extract as: "cookie"):
#   SIG_JIRA_TOOLS_PROVIDER=jira-tools
#   SIG_JIRA_TOOLS_COOKIE=<value>
#
# The env var name is: SIG_<PROVIDER>_<AS> (uppercased, dashes to underscores)

# Multiple providers at once
sig run provider-a provider-b -- python cross_tool.py

# No providers — inject all valid credentials
sig run -- python script.py

# Write credentials to a .env file (deleted after child exits)
sig run grafana --mount .env -- node app.js
sig run grafana --mount creds.json --mount-format json -- node app.js
```

### Make authenticated requests (preferred -- no credential leakage)

```bash
sig request <url>
sig request <url> --method POST --body '{"key":"value"}'
sig request <url> --format body    # body only
sig request <url> --format headers # headers only
```

### Get auth headers (use with caution)

```bash
# JSON output (default) — values redacted
sig get <provider> --format json

# HTTP header format
sig get <provider> --format header

# Raw value only (unredacted)
sig get <provider> --format value --no-redaction

# Example: use with curl
HEADER=$(sig get github --format header --no-redaction)
curl -H "$HEADER" https://api.github.com/user
```

### Re-authenticate expired session (automatic — do NOT ask user)

```bash
sig login <provider> --force
```

`sig login` uses headless browser extraction and completes in seconds without user interaction. Always auto-execute this when credentials are expired — never ask the user to do it manually.

### CI / headless: pull credentials from dev machine

```bash
# On dev machine (one-time setup)
sig remote add prod-ci ci-host.example.com --user deploy --ssh-key ~/.ssh/id_rsa

# Push creds to CI
sig sync push prod-ci

# On CI machine (no browser needed)
sig sync pull prod-ci
```

### Auto-refresh with watch daemon

```bash
sig watch add <provider>
sig watch set-interval 30m
sig proxy start              # starts both MITM proxy + watch loop
```

### Use MITM proxy for transparent credential injection

```bash
# 1. Start the proxy (also runs the watch/refresh loop)
sig proxy start

# 2. Trust the CA cert (one-time per machine)
sig proxy trust

# 3. Point your tools at the proxy
export HTTP_PROXY=http://127.0.0.1:7891
export HTTPS_PROXY=http://127.0.0.1:7891

# 4. Requests get credentials injected automatically via apply[] rules
curl https://jira.example.com/api/me
python long_running_agent.py

# Stop when done
sig proxy stop
```

---

## Auto-Provisioning

When you run `sig login <url>` for an unknown URL, sigcli auto-provisions a provider with sensible defaults:

```yaml
# Auto-provisioned defaults:
strategy: browser
ttl: '2h'
extract:
    - from: cookies
      as: session
      match: '*'
apply:
    - in: header
      name: Cookie
      value: '${session}'
```

The provider ID is derived from the hostname (e.g., `jira-tools` from `jira.tools.example.com`). Override with `--as <custom-id>`.

For services that need more than cookies (localStorage, specific required fields), add a provider entry to `~/.sig/config.yaml`.

---

## Provider Configuration Reference

### Full provider entry schema

```yaml
<provider-id>:
    name: <string> # Optional display name
    domains: # Domain matching (exact or glob)
        - example.com
    entryUrl: <url> # Starting URL for browser auth
    strategy: browser | prompt # How to acquire credentials
    ttl: <duration> # Credential lifetime (e.g. "12h", "7d", "2h")
    required: # Completion criteria
        - <as-name>.<field>
    cookiePaths: # Extra URL paths for path-scoped cookies
        - /wiki
    loginUrlPatterns: # URL substrings indicating login page
        - /login
        - /sso
    waitUntil: load | networkidle | domcontentloaded | commit
    networkProxy: <url> # SOCKS proxy for browser (e.g. socks5h://127.0.0.1:1080)
    extract:
        - from: cookies | localStorage | eval | prompt
          as: <key>
          match: <pattern>
          jsonPath: <dot.path>
          expiresJsonPath: <dot.path>
    apply:
        - in: header | body | query
          name: <field>
          value: <template>
          action: set | append | remove
```

### Common configurations

**Simple cookie SSO (most services):**

```yaml
my-jira:
    domains: [jira.example.com]
    entryUrl: https://jira.example.com/
    strategy: browser
    ttl: '10d'
    extract:
        - from: cookies
          as: cookie
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
```

Env var produced: `SIG_MY_JIRA_COOKIE`

**Cookie path scoping (Confluence):**

```yaml
my-wiki:
    domains: [wiki.example.com]
    entryUrl: https://wiki.example.com/
    strategy: browser
    cookiePaths: [/wiki]
    extract:
        - from: cookies
          as: cookie
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
```

**Required cookies (Reddit):**

```yaml
reddit:
    domains: [www.reddit.com, reddit.com]
    entryUrl: https://www.reddit.com/login
    strategy: browser
    ttl: '7d'
    networkProxy: socks5h://127.0.0.1:1080
    required:
        - cookie.reddit_session
        - cookie.token_v2
    extract:
        - from: cookies
          as: cookie
          match: '*'
    apply:
        - in: header
          name: Cookie
          value: '${cookie}'
```

Env var produced: `SIG_REDDIT_COOKIE`

**Cookies + localStorage (Slack):**

```yaml
app-slack:
    domains: [app.slack.com, edgeapi.slack.com]
    entryUrl: https://app.slack.com/client/<TEAM_ID>
    strategy: browser
    ttl: '7d'
    required:
        - session.d
        - xoxc-token
    extract:
        - from: cookies
          as: session
          match: '*'
        - from: localStorage
          as: xoxc-token
          match: 'localConfig_v2'
          jsonPath: 'teams.<TEAM_ID>.token'
    apply:
        - in: header
          name: Cookie
          value: '${session}'
        - in: header
          name: Authorization
          value: 'Bearer ${xoxc-token}'
```

Env vars produced: `SIG_APP_SLACK_SESSION`, `SIG_APP_SLACK_XOXC_TOKEN`

**OAuth2 via localStorage (Microsoft Teams):**

```yaml
ms-teams:
    name: Microsoft Teams
    domains: [teams.cloud.microsoft]
    entryUrl: https://teams.cloud.microsoft/v2/
    strategy: browser
    required:
        - access_token
    extract:
        - from: localStorage
          as: access_token
          match: '*|accesstoken|*ic3.teams.office.com*'
          jsonPath: 'secret'
          expiresJsonPath: 'expiresOn'
    apply:
        - in: header
          name: Authorization
          value: 'Bearer ${access_token}'
```

Env var produced: `SIG_MS_TEAMS_ACCESS_TOKEN`

**Prompt strategy (no browser):**

```yaml
github:
    name: GitHub
    domains: [github.com, api.github.com]
    entryUrl: https://github.com/settings/tokens
    strategy: prompt
    extract:
        - from: prompt
          as: token
          match: 'Enter your GitHub personal access token'
    apply:
        - in: header
          name: Authorization
          value: 'Bearer ${token}'
```

---

## Error Recovery Playbook

| Exit Code | Error                  | Cause                                       | Fix                                                               |
| --------- | ---------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `0`       | --                     | Success                                     | --                                                                |
| `1`       | `GENERAL_ERROR`        | Invalid args, unexpected failure            | Check `--verbose` output; verify command syntax                   |
| `2`       | `PROVIDER_NOT_FOUND`   | URL/ID doesn't match any provider in config | Run `sig providers` to list IDs; run `sig init` if not configured |
| `3`       | `CREDENTIAL_NOT_FOUND` | No stored credentials                       | Auto-run `sig login <url>` (no user prompt needed)                |
| `4`       | `REMOTE_NOT_FOUND`     | SSH remote not configured                   | Run `sig remote add <name> <host>`                                |

### Auth error codes (from `--verbose` stderr)

| Error Code                 | Cause                                | Fix                                                                    |
| -------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `CREDENTIAL_EXPIRED`       | TTL exceeded                         | Auto-run `sig login <provider> --force` (no user prompt needed)        |
| `BROWSER_LAUNCH_ERROR`     | No browser found or not installed    | `sig doctor` to diagnose; install Chrome                               |
| `BROWSER_TIMEOUT`          | Browser auth took too long           | Try again; ensure SSO/MFA completes within timeout                     |
| `BROWSER_UNAVAILABLE`      | Machine in browserless mode          | Use prompt strategy or `sig sync pull`                                 |
| `BROWSER_NAVIGATION_ERROR` | Failed to load URL                   | Check URL is reachable; check network                                  |
| `CONFIG_ERROR`             | Malformed `~/.sig/config.yaml`       | `sig doctor` to validate; fix YAML schema errors                       |
| `SYNC_CONFLICT`            | Local/remote credentials differ      | Add `--force`: `sig sync pull --force`                                 |
| `SYNC_ERROR`               | SSH connection or permission failure | Check SSH key, hostname; `sig remote list` to verify                   |
| `STORAGE_ERROR`            | Cannot read/write credential files   | Check permissions on `~/.sig/credentials/` and `~/.sig/encryption.key` |
| `ENCRYPTION_ERROR`         | Encryption key missing or corrupt    | Run `sig init` or regenerate `~/.sig/encryption.key`                   |

---

## Cost / Token Guide

### Cheap -- local only (no network, no browser)

```bash
sig get <provider>          # reads + decrypts local credential file
sig status [provider]       # reads credential files + parses TTL
sig providers               # reads config file
sig remote list             # reads config file
sig proxy status            # reads PID/port state files
```

### Moderate -- network I/O

```bash
sig request <url>           # one HTTP request (1-5s)
sig sync push|pull          # SSH + file transfer (5-30s)
```

### Expensive -- browser automation

```bash
sig login <url>             # 30-120s; launches browser
```

**Rule:** Always run `sig status` before `sig login`. If status shows valid credentials, skip login entirely.

---

## Important Rules for AI Agents

1. **Check before logging in.** Always run `sig status <provider>` first. Only call `sig login` if exit code is `3` (no credentials) or status shows expired. When login is needed, auto-execute it — do NOT ask the user to run it manually.

2. **Never display credential values.** `sig get` output is redacted by default. Do not use `--no-redaction` unless strictly necessary, and never log the output.

3. **Use `--format json` for parsing.** TTY-auto-detected table format is not stable.

4. **Prefer `sig run` over `sig get`.** `sig run` injects credentials directly into the child process environment and redacts output. `sig get` exposes values in shell history.

5. **Provider ID vs URL.** `sig get`, `sig status`, `sig logout` accept a provider ID. `sig login` accepts either a provider ID or URL (auto-provisions if unknown).

6. **Credentials are encrypted at rest.** Never commit, copy, or transmit credential files or `~/.sig/encryption.key`.

7. **Use `--verbose` to debug.** Internal logs go to stderr, hidden by default.

8. **Auto-provisioning works for most sites.** Only add config entries when you need localStorage extraction, required fields, or custom apply rules.

---

## Configuring Providers for Skills

Each skill needs a provider in `~/.sig/config.yaml`. See [`references/config-template.yaml`](references/config-template.yaml) for a ready-to-use template with common services pre-configured.

### Quick Start

```bash
# 1. Copy the template
cp references/config-template.yaml ~/.sig/config.yaml
# 2. Edit placeholders
$EDITOR ~/.sig/config.yaml
# 3. Login
sig login https://teams.cloud.microsoft/v2/   # MS Teams + Graph
sig login app-slack                            # Slack
```

### Using with Skills

```bash
# Env var injection
sig run ms-teams -- python scripts/teams_send.py
sig run app-slack -- python scripts/slack_send.py

# Or use the proxy
sig proxy start
export HTTP_PROXY=http://127.0.0.1:7891 HTTPS_PROXY=http://127.0.0.1:7891
python scripts/my_script.py
```
