# Spec: `sig run` — Credential-Injected Process Wrapper

**Status:** Draft
**Author:** Pylon PENG
**Date:** 2026-04-19

---

## Problem

Currently, using sigcli credentials in external scripts requires exposing secrets in shell variables:

```bash
CRED=$(sig get "$GRAFANA/" --format value)
python script.py --cookie "$CRED" ...
```

This leaks credentials into shell history, `ps` output, parent environment, and AI agent context windows.

## Solution

`sig run` spawns a child process with credentials injected as `SIG_*` environment variables. Output is redacted by default.

```bash
sig run --provider loki-orca -- python script.py --cookie "$SIG_COOKIE" ...
```

---

## Command Interface

```
sig run --provider <provider|url> [flags] -- <command> [args...]
```

### Flags

| Flag                   | Required | Default | Description                             |
| ---------------------- | -------- | ------- | --------------------------------------- |
| `--provider <id\|url>` | yes      | —       | Provider to get credentials from        |
| `--no-redaction`       | no       | false   | Disable output redaction                |
| `--expand-cookies`     | no       | false   | Set individual `SIG_COOKIE_<name>` vars |
| `--mount <file>`       | no       | —       | Write creds to file instead of env vars |
| `--mount-format <fmt>` | no       | `env`   | Mount file format: `env` or `json`      |

### Exit Behavior

- Pass through child process exit code
- On signal (SIGINT/SIGTERM): forward to child, clean up mount file, exit
- No valid credential: exit with error, suggest `sig login`

---

## Env Var Convention

### Always Set

| Var                   | Description     | Example                                |
| --------------------- | --------------- | -------------------------------------- |
| `SIG_PROVIDER`        | Provider ID     | `loki-orca`                            |
| `SIG_CREDENTIAL_TYPE` | Credential type | `cookie`, `bearer`, `api-key`, `basic` |

### Per Credential Type

**`cookie`:**

| Var                 | Description                                      | Example                |
| ------------------- | ------------------------------------------------ | ---------------------- |
| `SIG_COOKIE`        | Full cookie header string                        | `"session=abc; d=xyz"` |
| `SIG_COOKIE_<NAME>` | Individual cookie (only with `--expand-cookies`) | `SIG_COOKIE_D=xyz`     |

**`bearer`:**

| Var               | Description                   | Example            |
| ----------------- | ----------------------------- | ------------------ |
| `SIG_TOKEN`       | Bearer token value            | `eyJhbG...`        |
| `SIG_AUTH_HEADER` | Complete Authorization header | `Bearer eyJhbG...` |

**`api-key`:**

| Var               | Description                   | Example           |
| ----------------- | ----------------------------- | ----------------- |
| `SIG_API_KEY`     | API key value                 | `ghp_xxxx`        |
| `SIG_AUTH_HEADER` | Complete Authorization header | `Bearer ghp_xxxx` |

**`basic`:**

| Var               | Description                   | Example                  |
| ----------------- | ----------------------------- | ------------------------ |
| `SIG_USERNAME`    | Username                      | `admin`                  |
| `SIG_PASSWORD`    | Password                      | `secret`                 |
| `SIG_AUTH_HEADER` | Complete Authorization header | `Basic YWRtaW46c2VjcmV0` |

### xHeaders (Any Type, If Present)

Header names uppercased, `-` → `_`:

| Header         | Var                       |
| -------------- | ------------------------- |
| `x-csrf-token` | `SIG_HEADER_X_CSRF_TOKEN` |
| `origin`       | `SIG_HEADER_ORIGIN`       |

### localStorage (Any Type, If Present)

Key names uppercased, `-` → `_`:

| Key     | Var               |
| ------- | ----------------- |
| `token` | `SIG_LOCAL_TOKEN` |

---

## Output Redaction

### Algorithm

1. Collect all injected secret values from the credential
2. Filter out values shorter than 8 characters
3. Sort longest-first (prevent partial match masking)
4. Stream child's stdout/stderr through replacement filter
5. Buffer with overlap window (longest secret length) to catch chunk-boundary splits
6. Replace matches with `****` (same length as literal `****`, not same length as secret)
7. On first redaction, print to stderr: `[sig] Credential values redacted. Use --no-redaction to disable.`

### What Gets Redacted

| Credential Field         | Redacted           |
| ------------------------ | ------------------ |
| Bearer token             | yes                |
| API key                  | yes                |
| Password                 | yes                |
| Cookie values (each)     | yes, if >= 8 chars |
| Base64 basic auth string | yes                |
| xHeader values           | yes, if >= 8 chars |
| localStorage values      | yes, if >= 8 chars |
| Provider ID              | no                 |
| Username                 | no                 |
| Cookie names             | no                 |
| Header names             | no                 |

---

## Cascade Behavior

Before spawning the child process:

1. Check stored credential → if valid, use it
2. If expired, attempt refresh → if success, use it
3. If no credential or refresh fails → **error, do not open browser**

`sig run` is non-interactive. If credentials are missing, print:

```
Error: No valid credential for "loki-orca".
Run "sig login <url>" first, then retry.
```

---

## Mount Mode

`--mount <file>` writes credentials to a file instead of env vars.

```bash
sig run --provider api --mount .env -- docker compose up
```

### Lifecycle

1. Write credential env vars to `<file>` before spawning child
2. Spawn child process
3. On child exit (or SIGINT/SIGTERM): delete `<file>`

### Formats

**`env` (default):**

```
SIG_PROVIDER=loki-orca
SIG_CREDENTIAL_TYPE=cookie
SIG_COOKIE=session=abc; d=xyz
```

**`json`:**

```json
{
    "SIG_PROVIDER": "loki-orca",
    "SIG_CREDENTIAL_TYPE": "cookie",
    "SIG_COOKIE": "session=abc; d=xyz"
}
```

---

## Files to Create/Modify

| File                                          | Type   | Description                                                          |
| --------------------------------------------- | ------ | -------------------------------------------------------------------- |
| `cli/src/cli/commands/run.ts`                 | new    | Command: resolve provider, build env, spawn child, redact, mount     |
| `cli/src/utils/redact.ts`                     | new    | `extractSensitiveValues()`, `redactOutput()`, `createRedactStream()` |
| `cli/src/utils/credential-env.ts`             | new    | `credentialToEnvVars()` — maps credential to `SIG_*` pairs           |
| `cli/src/cli/main.ts`                         | modify | Wire command, help text, DEPS_COMMANDS                               |
| `cli/src/core/constants.ts`                   | modify | Add `RUN: 'run'` to Command                                          |
| `cli/tests/unit/utils/redact.test.ts`         | new    | Redaction logic tests                                                |
| `cli/tests/unit/utils/credential-env.test.ts` | new    | Env var mapping tests                                                |
| `cli/tests/unit/cli/run.test.ts`              | new    | Command integration tests                                            |
| `README.md`                                   | modify | Add sig run to commands table                                        |
| `CLAUDE.md`                                   | modify | Add run to command lists                                             |
| `cli/CLAUDE.md`                               | modify | Add run to command lists                                             |
| `skills/sigcli-auth/SKILL.md`                 | modify | Add sig run as recommended pattern                                   |

---

## SDD Test Plan

### Phase 1: Write Tests (All Failing)

**`credential-env.test.ts`** — 12 tests:

1. cookie credential → sets SIG_COOKIE, SIG_CREDENTIAL_TYPE, SIG_PROVIDER
2. cookie credential with --expand-cookies → sets SIG*COOKIE*<NAME> for each cookie
3. bearer credential → sets SIG_TOKEN, SIG_AUTH_HEADER
4. api-key credential → sets SIG_API_KEY, SIG_AUTH_HEADER
5. api-key with custom headerName/headerPrefix → SIG_AUTH_HEADER uses them
6. basic credential → sets SIG_USERNAME, SIG_PASSWORD, SIG_AUTH_HEADER (base64)
7. xHeaders present → sets SIG*HEADER*<NAME> for each
8. localStorage present → sets SIG*LOCAL*<NAME> for each
9. no xHeaders → no SIG*HEADER*\* vars
10. no localStorage → no SIG*LOCAL*\* vars
11. header name normalization: `x-csrf-token` → `X_CSRF_TOKEN`
12. localStorage key normalization: `workspace-id` → `WORKSPACE_ID`

**`redact.test.ts`** — 10 tests:

1. extractSensitiveValues from bearer → includes token
2. extractSensitiveValues from cookie → includes each cookie value >= 8 chars
3. extractSensitiveValues from api-key → includes key
4. extractSensitiveValues from basic → includes password, base64 string
5. extractSensitiveValues includes xHeader values >= 8 chars
6. extractSensitiveValues skips values shorter than 8 chars
7. redactOutput replaces single secret with \*\*\*\*
8. redactOutput replaces multiple secrets, longest first
9. redactOutput with no secrets returns input unchanged
10. redactOutput handles secret appearing multiple times

**`run.test.ts`** — 8 tests:

1. spawns child with SIG\_\* env vars
2. passes through child exit code
3. redacts credential values in stdout
4. --no-redaction passes output through unmodified
5. errors when no provider specified
6. errors when no credential available (suggests sig login)
7. --mount writes env file, deletes after child exits
8. --mount-format json writes JSON file

### Phase 2: Implement Until Green

### Phase 3: E2E Verification

```bash
# Env vars injected (values redacted in output)
sig run --provider loki-orca -- env | grep SIG_

# Redaction working
sig run --provider loki-orca -- sh -c 'echo "cookie: $SIG_COOKIE"'
# Expected: cookie: ****

# No redaction
sig run --provider loki-orca --no-redaction -- sh -c 'echo "$SIG_COOKIE"'
# Expected: actual cookie value

# Exit code pass-through
sig run --provider loki-orca -- sh -c 'exit 42'; echo $?
# Expected: 42

# No credential error
sig run --provider nonexistent -- echo hello
# Expected: Error: No valid credential for "nonexistent". Run "sig login" first.

# Mount mode
sig run --provider loki-orca --mount /tmp/test.env -- cat /tmp/test.env
# Expected: SIG_COOKIE=**** (redacted in stdout)

# Real use case
sig run --provider loki-orca -- python sap-loki/scripts/loki_query.py \
  --cookie "$SIG_COOKIE" --grafana-url "$GRAFANA" ...
```
