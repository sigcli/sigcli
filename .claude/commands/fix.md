# /fix — Bug Investigation and Fix

You are orchestrating the sigcli agent team to investigate and fix a bug.
The user's report: $ARGUMENTS

## Workflow

### Phase 1: Investigation
Spawn the **architect** agent with this prompt:
> Investigate a bug in the sigcli project: $ARGUMENTS
>
> Trace the call chain from handler → AuthManager → strategy/storage/browser to locate the fault. Read relevant source files, identify the root cause, and propose a minimal fix. Include: which file(s) to change, what the fix looks like, and how to write a regression test.

Present the diagnosis and proposed fix to the user. **Wait for user approval before proceeding.**

### Phase 2: Fix + Regression Test
Spawn the **dev** agent and **tester** agent. The dev agent fixes the code, the tester writes a regression test.

**dev** agent prompt:
> Fix this bug in the sigcli project:
> [Include the architect's diagnosis and proposed fix]
>
> Apply the minimal fix following project conventions. Run npm run build to verify types.

**tester** agent prompt:
> Write a regression test for this bug fix:
> [Describe the bug and what was fixed]
>
> Write a test that would have caught this bug — it should fail without the fix and pass with it. Add it to the appropriate test file in tests/unit/. Run npm test to verify all tests pass.

### Phase 3: Review
Spawn the **reviewer** agent with this prompt:
> Review the bug fix for:
> [Describe the bug and fix]
>
> Verify the fix is correct and minimal. Check that the regression test actually covers the bug. Run tsc --noEmit and npm test. Report findings.

### Phase 4: Report
Summarize: root cause, fix applied, regression test added, review status.
