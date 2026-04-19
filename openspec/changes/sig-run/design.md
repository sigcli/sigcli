# Design: sig run

## Technical Approach

Child process spawned via `node:child_process.spawn` with `stdio: ['inherit', 'pipe', 'pipe']`. Stdout/stderr piped through redaction transform before writing to parent's stdout/stderr.

## Architecture Decisions

### Decision: Env Vars over Stdin

Using environment variables instead of piping credentials via stdin because:

- Child processes read `$SIG_COOKIE` naturally — no protocol needed
- Works with any language, any tool
- Matches Doppler/Sigillo/dotenv conventions

### Decision: Known-Value Redaction over Entropy

Using exact string replacement instead of Shannon entropy detection because:

- Zero false positives — only masks values we injected
- Simpler implementation, easier to reason about
- Entropy detection can be added later as opt-in `--entropy-redaction`

### Decision: Stream Buffering for Chunk Boundaries

Output redaction buffers the last N bytes (where N = longest secret length) to handle secrets split across read chunks. This adds minimal latency but prevents bypass via chunk alignment.

## Env Var Naming Convention

```
SIG_PROVIDER            — always set, provider ID
SIG_CREDENTIAL_TYPE     — always set: cookie|bearer|api-key|basic
SIG_AUTH_HEADER         — complete Authorization header value (not set for cookie type)

SIG_TOKEN               — bearer token value
SIG_API_KEY             — api key value
SIG_USERNAME            — basic auth username
SIG_PASSWORD            — basic auth password
SIG_COOKIE              — full cookie header string ("k=v; k2=v2")
SIG_COOKIE_<NAME>       — individual cookie (only with --expand-cookies), name uppercased

SIG_HEADER_<NAME>       — xHeader values, name uppercased, dashes → underscores
SIG_LOCAL_<NAME>        — localStorage values, key uppercased, dashes → underscores
```

## Data Flow

```
sig run --provider X -- child-cmd args
        │
        ▼
  ┌─ Cascade ─────────────────────────┐
  │  stored → refresh → error (no UI) │
  └──────────┬────────────────────────┘
             │ credential
             ▼
  ┌─ credentialToEnvVars() ───────────┐
  │  Maps credential → SIG_* pairs    │
  └──────────┬────────────────────────┘
             │ env vars
             ▼
  ┌─ spawn(child-cmd, { env }) ───────┐
  │  child.stdout ──► redact ──► stdout│
  │  child.stderr ──► redact ──► stderr│
  │  child.exit  ──► process.exitCode  │
  └────────────────────────────────────┘
```

## File Changes

| File                              | Type   | Description                                                                                           |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `cli/src/cli/commands/run.ts`     | new    | Command handler                                                                                       |
| `cli/src/utils/credential-env.ts` | new    | `credentialToEnvVars(credential, providerId, options)`                                                |
| `cli/src/utils/redact.ts`         | new    | `extractSensitiveValues(credential)`, `redactOutput(text, secrets)`, `createRedactTransform(secrets)` |
| `cli/src/cli/main.ts`             | modify | Wire command, help text                                                                               |
| `cli/src/core/constants.ts`       | modify | Add `RUN: 'run'`                                                                                      |
| `README.md`                       | modify | Add sig run to commands                                                                               |
| `cli/CLAUDE.md`                   | modify | Add run to command list                                                                               |
| `skills/sigcli-auth/SKILL.md`     | modify | Recommend sig run for scripts                                                                         |
