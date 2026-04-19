# Tasks

## 1. Core Utilities (Tests First)

- [ ] 1.1 Write `credential-env.test.ts` — 12 tests for env var mapping (all credential types, xHeaders, localStorage, normalization)
- [ ] 1.2 Write `redact.test.ts` — 10 tests for secret extraction and output redaction
- [ ] 1.3 Implement `cli/src/utils/credential-env.ts` — make credential-env tests pass
- [ ] 1.4 Implement `cli/src/utils/redact.ts` — make redact tests pass

## 2. Command (Tests First)

- [ ] 2.1 Write `run.test.ts` — 8 tests for command behavior (spawn, exit code, redaction, mount, errors)
- [ ] 2.2 Implement `cli/src/cli/commands/run.ts` — make run tests pass
- [ ] 2.3 Wire in `main.ts` — add RUN to constants, import, help text, DEPS_COMMANDS, switch case
- [ ] 2.4 Update `constants.test.ts` — bump command count

## 3. Documentation

- [ ] 3.1 Add `sig run` to README commands table
- [ ] 3.2 Add `run` to CLAUDE.md (root + cli) command lists
- [ ] 3.3 Add `sig run` as recommended pattern in SKILL.md

## 4. Verification

- [ ] 4.1 `cd cli && npm run build && npm test` — all tests pass
- [ ] 4.2 E2E: `sig run --provider <real-provider> -- env | grep SIG_`
- [ ] 4.3 E2E: `sig run --provider <real-provider> -- sh -c 'echo $SIG_COOKIE'` shows `****`
- [ ] 4.4 E2E: `sig run --provider <real-provider> --no-redaction -- sh -c 'echo $SIG_COOKIE'` shows real value
- [ ] 4.5 E2E: `sig run --provider nonexistent -- echo hello` shows error with login suggestion
- [ ] 4.6 E2E: `sig run --provider <real-provider> -- sh -c 'exit 42'; echo $?` returns 42
