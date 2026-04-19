# /adapter — Add New Browser Adapter

You are orchestrating the sigcli agent team to add a new browser adapter.
The user's request: $ARGUMENTS

## Context
Browser adapters implement `IBrowserAdapter`, `IBrowserSession`, and `IBrowserPage` from `src/core/interfaces/browser-adapter.ts`. The reference implementation is `PlaywrightAdapter` in `src/browser/adapters/playwright.adapter.ts` (three-class pattern: Adapter → Session → Page).

## Workflow

### Phase 1: Design
Spawn the **architect** agent with this prompt:
> Design a new browser adapter for the sigcli project: $ARGUMENTS
>
> You MUST read these files first:
> 1. `src/core/interfaces/browser-adapter.ts` — the IBrowserAdapter/IBrowserSession/IBrowserPage contract
> 2. `src/browser/adapters/playwright.adapter.ts` — the reference implementation (three-class pattern)
> 3. `src/core/types.ts` — BrowserLaunchOptions, Cookie types
>
> Design the adapter following the three-class pattern. Map every IBrowserPage method to the target library's equivalent. Identify which library methods need adaptation. Plan the file structure, exports, and tests.

Present the plan to the user. **Wait for approval.**

### Phase 2: Implement
Spawn the **dev** agent with the approved plan:
> Implement the new browser adapter:
> [Include architect's plan]
>
> Create `src/browser/adapters/<name>.adapter.ts` with three classes (Adapter, Session, Page). Lazy-import the browser library. Throw BrowserLaunchError on import failure. Export the Adapter class. Add it to `src/index.ts`. Run npm run build.

### Phase 3: Test
Spawn the **tester** agent:
> Write unit tests for the new browser adapter at `src/browser/adapters/<name>.adapter.ts`.
> [Describe what was implemented]
>
> Create tests in `tests/unit/browser/`. Test: adapter has correct name property, launch method exists, Session and Page wrap the library correctly. Mock the underlying library. Run npm test.

### Phase 4: Review
Spawn the **reviewer** agent:
> Review the new browser adapter implementation.
> [Describe what was built]
>
> Check: three-class pattern, lazy import, BrowserLaunchError on failure, all IBrowserPage methods mapped, exported in index.ts, tests exist. Run tsc --noEmit and npm test.

### Phase 5: Report
Summarize: adapter created, files added, tests passing, review status.
