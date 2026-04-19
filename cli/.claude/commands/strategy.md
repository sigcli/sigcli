# /strategy — Add New Auth Strategy

You are orchestrating the signet agent team to add a new authentication strategy.
The user's request: $ARGUMENTS

## Context
Strategies implement `IAuthStrategy` (validate, authenticate, refresh, applyToRequest) via an `IAuthStrategyFactory`. They live in `src/strategies/`. Reference: `cookie.strategy.ts` (browser-based) or `api-token.strategy.ts` (non-browser).

## Workflow

### Phase 1: Design
Spawn the **architect** agent with this prompt:
> Design a new auth strategy for the signet project: $ARGUMENTS
>
> You MUST read these files first:
> 1. `src/core/interfaces/auth-strategy.ts` — IAuthStrategy (4 methods) + IAuthStrategyFactory
> 2. `src/strategies/cookie.strategy.ts` — reference for browser-based strategies (uses runHybridFlow)
> 3. `src/strategies/api-token.strategy.ts` — reference for non-browser strategies
> 4. `src/core/types.ts` — Credential union, StrategyConfig
> 5. `src/core/errors.ts` — AuthError hierarchy
>
> Design: private config interface, parseConfig(), private Strategy class implementing all 4 methods, exported Factory. Specify what each method does for this auth type. Identify if browser-based (needs runHybridFlow) or non-browser.

Present the plan to the user. **Wait for approval.**

### Phase 2: Implement
Spawn the **dev** agent with the approved plan:
> Implement the new auth strategy:
> [Include architect's plan]
>
> Create `src/strategies/<name>.strategy.ts` with: private config type, parseConfig(), private Strategy class, exported Factory with `readonly name`. Register in `src/server.ts` composition root. Export Factory from `src/index.ts`. Run npm run build.

### Phase 3: Test
Spawn the **tester** agent:
> Write unit tests for the new strategy at `src/strategies/<name>.strategy.ts`.
> [Describe what was implemented]
>
> Create tests in `tests/unit/strategies/<name>.test.ts`. Test: validate (valid/invalid/expired credentials), authenticate (happy path or ManualSetupRequired), refresh (supported or returns null), applyToRequest (correct headers). Use MemoryStorage. Run npm test.

### Phase 4: Review
Spawn the **reviewer** agent:
> Review the new auth strategy implementation.
> [Describe what was built]
>
> Check: Factory pattern (private class, exported factory, readonly name), all 4 IAuthStrategy methods, Result<T,E> usage, registered in server.ts, exported in index.ts, tests cover all methods. Run tsc --noEmit and npm test.

### Phase 5: Report
Summarize: strategy created, registered, tests passing, review status.
