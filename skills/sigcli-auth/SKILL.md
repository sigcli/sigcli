# sigcli-auth Skill

Operate sigcli to authenticate with any web service from the CLI. This guide is written for AI agents (Claude Code, Cursor) that need to obtain, check, and use auth credentials programmatically.

## Overview

sigcli (`sig`) is a CLI tool that stores and manages authentication credentials for web services. It supports browser-based SSO, OAuth2, API tokens, cookies, and HTTP Basic auth. Credentials are encrypted at rest (AES-256-GCM) and stored locally (`~/.sig/`), then applied automatically to HTTP requests.

**Binary:** `sig`  
**Config:** `~/.sig/config.yaml`  
**Credentials:** `~/.sig/credentials/<provider-id>.json` (encrypted, AES-256-GCM)  
**Encryption key:** `~/.sig/encryption.key`

---

## Available Commands

| Command                          | Description                                      | When to Use                                     | Typical Latency                  |
| -------------------------------- | ------------------------------------------------ | ----------------------------------------------- | -------------------------------- |
| `sig init`                       | Create/initialize config                         | First-time setup                                | < 1s                             |
| `sig doctor`                     | Validate environment, config, and encryption key | Troubleshoot setup issues                       | 1-3s                             |
| `sig login <url>`                | Authenticate with a service                      | No stored credentials, or expired               | 30-120s (browser) / < 1s (token) |
| `sig logout [provider]`          | Clear stored credentials                         | Reset auth state                                | < 1s                             |
| `sig get <provider\|url>`        | Retrieve credential headers                      | Get headers for curl or scripts                 | < 1s                             |
| `sig request <url>`              | Make authenticated HTTP request                  | Test an endpoint with auth applied              | 1-5s                             |
| `sig status [provider]`          | Show auth status for all/one provider            | Check if logged in before acting                | 1-3s                             |
| `sig providers`                  | List configured providers                        | Discover what is configured                     | 1-3s                             |
| `sig rename <old> <new>`         | Rename a provider                                | Reorganize providers                            | < 1s                             |
| `sig remove <provider> [...]`    | Delete provider(s) and credentials               | Clean up                                        | < 1s                             |
| `sig remote add <name> <host>`   | Add SSH remote for credential sync               | Set up headless machine sync                    | < 1s                             |
| `sig remote remove <name>`       | Remove SSH remote                                | Clean up                                        | < 1s                             |
| `sig remote list`                | List configured remotes                          | Inspect sync targets                            | < 1s                             |
| `sig sync push\|pull [remote]`   | Sync credentials over SSH                        | Share credentials with headless machines        | 5-30s                            |
| `sig watch add <provider>`       | Add provider to auto-refresh watch list          | Keep long-lived sessions alive                  | < 1s                             |
| `sig watch remove <provider>`    | Remove from watch list                           | Stop auto-refresh                               | < 1s                             |
| `sig watch set-interval <dur>`   | Set default watch interval                       | Tune refresh frequency                          | < 1s                             |
| `sig proxy start [--port N]`     | Start MITM proxy daemon                          | Daemons/tools that read HTTP_PROXY env vars     | < 1s (daemon runs in background) |
| `sig proxy stop`                 | Stop proxy daemon                                | Shut down proxy                                 | < 1s                             |
| `sig proxy status`               | Show proxy running state and port                | Check if proxy is running                       | < 1s                             |
| `sig proxy trust`                | Print CA cert path + OS trust instructions       | First-time proxy setup                          | < 1s                             |
| `sig run [provider...] -- <cmd>` | Run command with credentials in env              | Scripts that need SIG\_<PROVIDER\>\_\* env vars | < 1s + child process             |

---

## Strategy Selection Guide

Use this decision tree to choose the right `sig login` approach:

```
Do you have credentials already?
|
+- YES: Has API key or Personal Access Token (GitHub, GitLab, etc.)
|       +- sig login <url> --token <value>         # < 1s, no browser
|
+- YES: Has cookies copied from browser DevTools (Network tab -> Copy as curl)
|       +- sig login <url> --cookie "k=v; k2=v2"  # < 1s, no browser
|
+- YES: Has username + password (HTTP Basic auth)
|       +- sig login <url> --username <u> --password <p>  # < 1s, no browser
|
+- NO: Must complete SSO/OAuth in a browser
        |
        +- Machine HAS a display (developer laptop)
        |   +- sig login <url>                     # 30-120s, opens browser
        |
        +- Machine is HEADLESS / CI / remote
            +- sig sync pull                       # Pull creds from a machine that has them
               (requires: sig remote add first, credentials exist on source machine)
```

### Strategy flag override

If auto-detection picks the wrong strategy, force one:

```bash
sig login <url> --strategy cookie      # Browser SSO -> CookieCredential
sig login <url> --strategy oauth2      # Browser OAuth2 -> BearerCredential
sig login <url> --strategy api-token   # Static API key -> ApiKeyCredential
sig login <url> --strategy basic       # Username/password -> BasicCredential
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

### Run scripts with credentials injected (recommended for scripts)

Use `sig run` to inject credentials as `SIG_<PROVIDER>_*` environment variables without exposing them in shell history or `ps` output. Credential values are automatically redacted from child stdout/stderr.

```bash
# Discover available environment variables for a provider
sig run grafana -- env | grep SIG_GRAFANA_

# Run a script with credentials available as SIG_<PROVIDER>_* env vars
sig run grafana -- python fetch_data.py

# The child process can read (e.g. for provider "grafana"):
#   SIG_GRAFANA_PROVIDER, SIG_GRAFANA_CREDENTIAL_TYPE
#   SIG_GRAFANA_TOKEN / SIG_GRAFANA_COOKIE / SIG_GRAFANA_API_KEY etc.
#   SIG_GRAFANA_AUTH_HEADER — complete Authorization header value

# Multiple providers at once
sig run provider-a provider-b -- python cross_tool.py

# No providers — inject all valid credentials
sig run -- python script.py

# Expand individual cookies as SIG_<PROVIDER>_COOKIE_<NAME>=value
sig run my-jira --expand-cookies -- python script.py

# Write credentials to a .env file (deleted after child exits)
sig run grafana --mount .env -- node app.js

# Disable redaction (see raw values in output -- use with caution)
sig run grafana --no-redaction -- env | grep SIG_
```

**Why prefer `sig run` over `sig get`:** `sig get` exposes credentials in shell variables visible to `ps`, shell history, and AI agent context. `sig run` injects credentials directly into the child environment and redacts them from output.

### Make authenticated requests (preferred -- no credential leakage)

```bash
# Use sig request instead of sig get + curl -- credentials stay internal
sig request <url>
sig request <url> --method POST --body '{"key":"value"}'
```

### Get auth headers (use with caution -- credentials visible in shell)

> **Security note:** Prefer `sig request` over `sig get` + curl. The commands below
> expose raw credentials in shell history and process lists. Use only when you must
> pass headers to an external tool, and never log the output.

```bash
# JSON output (default)
sig get <provider> --format json

# HTTP header format -- pipe directly into curl (credential visible in output)
sig get <provider> --format header

# Value only (credential visible in output)
sig get <provider> --format value
# Output: eyJ...

# Example: use with curl
HEADER=$(sig get github --format header)
curl -H "$HEADER" https://api.github.com/user
```

### Make an authenticated request

```bash
sig request https://api.example.com/endpoint
sig request https://api.example.com/endpoint --method POST --body '{"key":"val"}'
sig request https://api.example.com/endpoint --format body   # body only
sig request https://api.example.com/endpoint --format headers  # headers only
```

### Re-authenticate expired session

```bash
sig logout <provider>
sig login <url>
```

### Authenticate with API token (no browser)

```bash
sig login https://github.com --token ghp_xxxxxxxxxxxx
sig login https://gitlab.com --token glpat-xxxxxxxxxxxx
```

### Authenticate with cookies from DevTools

1. Open DevTools -> Network tab -> find any authenticated request -> Copy as cURL
2. Extract the `Cookie:` header value
3. Run: `sig login <url> --cookie "session=abc123; csrf=xyz"`

### CI / headless: pull credentials from dev machine

```bash
# On dev machine (one-time setup)
sig remote add prod-ci ci-host.example.com --user deploy --ssh-key ~/.ssh/id_rsa

# Push creds to CI
sig sync push prod-ci

# On CI machine (no browser needed)
sig sync pull prod-ci
sig get <provider> --format header  # use in pipelines
```

### Machine-readable output for scripts

Available formats for `sig status`, `sig providers`, `sig remote list`, `sig watch list`: `json`, `yaml`, `env`, `table`, `plain`.

```bash
sig status --format json    # structured JSON, not a TTY table
sig providers --format json
sig remote list --format json
sig get <provider> --format json   # includes type, headerName, value, xHeaders
```

### Auto-refresh with watch daemon

```bash
sig watch add <provider>
sig watch set-interval 30m   # change default refresh interval
# The watch loop runs automatically inside the proxy daemon:
sig proxy start              # starts both MITM proxy + watch loop
```

### Use MITM proxy for transparent credential injection

Use `sig proxy` when you have tools that can't be wrapped with `sig run` — long-lived daemons, tools that fork process trees, or tools that only read proxy env vars.

```bash
# 1. Start the proxy (also runs the watch/refresh loop)
sig proxy start

# 2. Trust the CA cert (one-time per machine)
sig proxy trust   # prints path + OS-specific instructions

# 3. Point your tools at the proxy
export HTTP_PROXY=http://127.0.0.1:7891
export HTTPS_PROXY=http://127.0.0.1:7891

# 4. Now any HTTP/HTTPS request gets credentials injected automatically
curl https://jira.example.com/api/me   # no SIG_* env vars needed
python long_running_agent.py           # daemon never sees credentials

# Stop when done
sig proxy stop
```

**When to use proxy vs sig run:**

- `sig run` — simpler, wraps a single command, no CA trust required
- `sig proxy` — for daemons, process trees, or tools that only respect proxy env vars

---

## Error Recovery Playbook

| Exit Code | Error                  | Cause                                       | Fix                                                               |
| --------- | ---------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `0`       | --                     | Success                                     | --                                                                |
| `1`       | `GENERAL_ERROR`        | Invalid args, unexpected failure            | Check `--verbose` output; verify command syntax                   |
| `2`       | `PROVIDER_NOT_FOUND`   | URL/ID doesn't match any provider in config | Run `sig providers` to list IDs; run `sig init` if not configured |
| `3`       | `CREDENTIAL_NOT_FOUND` | No stored credentials                       | Run `sig login <url>`                                             |
| `4`       | `REMOTE_NOT_FOUND`     | SSH remote not configured                   | Run `sig remote add <name> <host>`                                |

### Auth error codes (from `--verbose` stderr)

| Error Code                 | Cause                                                    | Fix                                                                    |
| -------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `CREDENTIAL_EXPIRED`       | Token/cookie expired, refresh failed                     | `sig logout <provider> && sig login <url>`                             |
| `CREDENTIAL_TYPE_MISMATCH` | Wrong credential type for provider                       | Re-login with correct strategy: `--strategy <name>`                    |
| `REFRESH_FAILED`           | OAuth2 refresh token rejected                            | Re-login: `sig logout <provider> && sig login <url>`                   |
| `BROWSER_LAUNCH_ERROR`     | playwright-core not installed or no browser channel      | `sig doctor` to diagnose; install playwright-core or chrome            |
| `BROWSER_TIMEOUT`          | Browser auth took too long (30s headless / 120s visible) | Try again; if CAPTCHA/MFA: ensure visible browser mode                 |
| `BROWSER_UNAVAILABLE`      | Machine is in browserless mode                           | Use `--token`/`--cookie` or `sig sync pull`                            |
| `BROWSER_NAVIGATION_ERROR` | Failed to load URL in browser                            | Check URL is reachable; check network                                  |
| `CONFIG_ERROR`             | Malformed `~/.sig/config.yaml`                           | `sig doctor` to validate; fix YAML schema errors                       |
| `SYNC_CONFLICT`            | Local/remote credentials differ                          | Add `--force` to overwrite: `sig sync pull --force`                    |
| `SYNC_ERROR`               | SSH connection or permission failure                     | Check SSH key, hostname, and user; `sig remote list` to verify config  |
| `STORAGE_ERROR`            | Cannot read/write credential files                       | Check permissions on `~/.sig/credentials/` and `~/.sig/encryption.key` |
| `ENCRYPTION_ERROR`         | Encryption key missing or corrupt                        | Run `sig init` or delete and regenerate `~/.sig/encryption.key`        |

---

## Cost / Token Guide

Operations fall into two categories:

### Cheap -- local only (no network, no browser)

These are instant and safe to call frequently:

```bash
sig get <provider>          # reads + decrypts local credential file
sig status [provider]       # reads credential files + decrypts + parses JWT
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

Avoid unless necessary. These launch a headless (or visible) browser:

```bash
sig login <url>             # 30-120s; uses playwright-core
```

**Rule:** Always run `sig status` before `sig login`. If status shows valid credentials, skip login entirely.

---

## Important Rules for AI Agents

1. **Check before logging in.** Always run `sig status <provider>` first. Only call `sig login` if exit code is `3` (no credentials) or status shows expired.

2. **Never display credential values.** `sig get` output may contain bearer tokens or API keys. Do not log, print, or include in prompts or tool call args.

3. **Use `--format json` for parsing.** Pipe/script consumers should always pass `--format json` to get structured output. TTY-auto-detected table format is not stable for parsing.

4. **Prefer `--token`/`--cookie` on headless machines.** Browser auth requires a display. In CI/CD or SSH sessions without X11, use token/cookie login or `sig sync pull`.

5. **Provider ID vs URL.** `sig get`, `sig status`, `sig logout` accept a provider ID (e.g., `github`). `sig login` accepts a URL (e.g., `https://github.com`) -- it auto-creates the provider. You can override the ID with `--as`.

6. **Credentials are encrypted at rest.** `~/.sig/credentials/` stores AES-256-GCM encrypted files. The encryption key is at `~/.sig/encryption.key`. Do not commit, copy, or transmit credential files or the encryption key.

7. **`sig proxy start` runs a background daemon.** Only invoke once; use `sig proxy stop` to shut it down. For credential refresh, the proxy runs the watch loop automatically — no need to run `sig watch start` separately.

8. **Use `--verbose` to debug.** All internal logs go to stderr and are hidden by default. Add `--verbose` when diagnosing failures.

---

## Configuring Providers for Skills

Each skill needs a provider in `~/.sig/config.yaml`. See [`references/config-template.yaml`](references/config-template.yaml) for a ready-to-use template with all skills pre-configured (Jira, Outlook, MS Teams, Slack). Replace placeholder values (`<...>`) with your organization's URLs and IDs.

### Quick Start

```bash
# 1. Copy the template
cp references/config-template.yaml ~/.sig/config.yaml
# 2. Edit placeholders
$EDITOR ~/.sig/config.yaml
# 3. Login
sig login https://<your-jira-domain>/              # Jira
sig login https://teams.cloud.microsoft/v2/        # MS Teams + Outlook (one login for both)
sig login app-slack                                 # Slack
```

### Using with Skills

```bash
# Env var injection — credentials available as SIG_<PROVIDER>_* env vars
sig run jira -- python scripts/my_script.py
sig run ms-graph -- python scripts/outlook_send.py
sig run app-slack -- python scripts/slack_send.py

# Or use the proxy — credentials injected transparently into HTTP requests
sig proxy start
export HTTP_PROXY=http://127.0.0.1:7891 HTTPS_PROXY=http://127.0.0.1:7891
python scripts/my_script.py   # no SIG_* env vars needed
```
