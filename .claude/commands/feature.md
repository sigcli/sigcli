# /feature — End-to-End Feature Delivery

You are orchestrating the sigcli agent team to deliver a feature end-to-end.
The user's request: $ARGUMENTS

## Workflow

Execute these phases in order. Do NOT skip phases. Present results to the user between phases.

### Phase 1: Architecture & Design
Spawn the **architect** agent with this prompt:
> Analyze the sigcli codebase and design an implementation plan for: $ARGUMENTS
>
> Read the relevant interfaces from src/core/interfaces/, study reference implementations, identify reusable code, and produce a concrete plan with: files to create/modify, interfaces to implement, patterns to follow, wiring steps, and test plan.

Present the architect's plan to the user. **Wait for user approval before proceeding.**

### Phase 2: Implementation
Spawn the **dev** agent with this prompt:
> Implement the following plan for the sigcli project:
> [Include the architect's approved plan here]
>
> Follow all project conventions: Result<T,E> pattern, .js import extensions, Factory pattern for strategies, three-class pattern for adapters, register*Handler for MCP tools. Wire new components in server.ts, handlers/index.ts, and index.ts as needed. Run npm run build when done.

### Phase 3: Testing
Spawn the **tester** agent with this prompt:
> Write unit tests for the code just implemented:
> [Describe what was implemented and which files were created/modified]
>
> Follow existing test patterns in tests/unit/. Use vitest, MemoryStorage for isolation, isOk/isErr assertions. Cover happy paths, error paths, and edge cases. Run npm test to verify all tests pass.

### Phase 4: Review
Spawn the **reviewer** agent with this prompt:
> Review the complete changeset for:
> [Describe what was implemented]
>
> Check: type safety (run tsc --noEmit), Result pattern compliance, ESM imports with .js extensions, pattern compliance (Factory/three-class/registerHandler), wiring (server.ts, handlers/index.ts, index.ts), test coverage (exist, cover error paths). Run npm test. Report structured findings.

### Phase 5: Report
Summarize the full delivery to the user:
- What was built
- Files created/modified
- Tests added
- Review findings (if any issues need attention)
