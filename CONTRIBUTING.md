# Contributing to SigCLI

## Setup

```bash
git clone https://github.com/sigcli/sigcli.git
cd sigcli
npm install    # also installs git hooks via husky
```

## Development Workflow

```bash
npm run dev          # Build and run CLI
npm test             # Run tests
npm run test:watch   # Watch mode
npm run build        # TypeScript compile
```

## Code Quality

This project enforces a unified coding style via ESLint + Prettier with pre-commit hooks.

```bash
npm run lint         # Check for lint errors
npm run lint:fix     # Auto-fix lint errors
npm run format       # Format all files
npm run format:check # Check formatting (used in CI)
```

The pre-commit hook runs `lint-staged` automatically, which applies ESLint and Prettier to staged files. You should rarely need to run these commands manually.

## Code Conventions

- **TypeScript strict mode** with ES2022 target
- **ESM imports** — always use `.js` extension in relative imports
- **2-space indentation**, single quotes, semicolons
- **Result pattern** — use `ok()`/`err()` from `src/core/result.ts`, never throw for expected failures
- **Interface prefix** — `IStorage`, `IAuthStrategy`, `IBrowserAdapter`
- **Strategy pattern** — private class + exported factory

See [CLAUDE.md](CLAUDE.md) for detailed architecture and extension points.

## Pull Requests

- All CI checks must pass (lint, format, type check, tests, build)
- Keep PRs focused — one feature or fix per PR
- Write tests for new functionality
