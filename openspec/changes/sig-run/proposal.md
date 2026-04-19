# Proposal: `sig run` — Credential-Injected Process Wrapper

## Intent

Using sigcli credentials in external scripts currently requires exposing secrets in shell variables:

```bash
CRED=$(sig get "$GRAFANA/" --format value)
python script.py --cookie "$CRED" ...
```

This leaks credentials into shell history, `ps` output, parent environment, and AI agent context windows. We need a way to run child processes with credentials injected securely.

## Scope

In scope:

- New `sig run` command that spawns a child process with `SIG_*` env vars
- Env var convention for all credential types (cookie, bearer, api-key, basic, xHeaders, localStorage)
- Output redaction — mask credential values in child stdout/stderr
- Mount mode — write credentials to a temp file, clean up on exit
- Cascade credential check (stored → refresh → error, no browser)

Out of scope:

- Entropy-based detection of unknown secrets (future work)
- Browser-based auth from within `sig run` (non-interactive by design)
- Credential rotation during long-running child processes

## Approach

Spawn child process via `node:child_process.spawn` with credentials injected as `SIG_*` env vars. Stream stdout/stderr through a replacement filter that masks known credential values. Support `--mount` for tools that need file-based credentials.
