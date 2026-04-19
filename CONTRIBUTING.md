# Contributing to Sigcli

## Prerequisites

| Tool        | Version | Notes                          |
| ----------- | ------- | ------------------------------ |
| **Node.js** | >= 18   | Tested on 18, 20, 22           |
| **pnpm**    | 10      | `npm install -g pnpm`          |
| **Python**  | >= 3.9  | Only needed for the Python SDK |

No system-level browser install is required — Playwright downloads its own Chromium binary.

## Setup

```bash
git clone https://github.com/sigcli/sigcli.git
cd sigcli
pnpm install          # installs all workspace deps + git hooks via husky
pnpm -r build         # builds all packages
```

Run tests for CLI and SDK (the website has no tests, so `pnpm -r test` will fail):

```bash
pnpm --filter @sigcli/cli --filter @sigcli/sdk test
```

After building, run the CLI directly:

```bash
node cli/bin/sig.js --help
```

Or link it globally for development:

```bash
cd cli && pnpm link --global
sig --help
```

## Common Commands

### Root (all packages)

```bash
pnpm install                                        # install dependencies
pnpm -r build                                       # build everything
pnpm --filter @sigcli/cli --filter @sigcli/sdk test  # test CLI + SDK
pnpm lint                                           # ESLint
pnpm lint:fix                                       # ESLint auto-fix
pnpm format                                         # Prettier format
pnpm format:check                                   # check formatting (same as CI)
```

### CLI

```bash
pnpm --filter @sigcli/cli build         # tsc → dist/
pnpm --filter @sigcli/cli test          # vitest run
pnpm --filter @sigcli/cli test:watch    # vitest watch mode
pnpm --filter @sigcli/cli dev           # build + run CLI
```

### TypeScript SDK

```bash
pnpm --filter @sigcli/sdk build
pnpm --filter @sigcli/sdk test
```

### Python SDK

```bash
cd sdk/python
pip install -e ".[dev]"
pytest
mypy src/
```

### Website

```bash
pnpm --filter website dev               # dev server on port 3000
pnpm --filter website build             # production build
```

## Code Quality

Husky + lint-staged runs ESLint and Prettier on every commit automatically. Style: 4-space indent, single quotes, semicolons, 100-char width (see `.prettierrc`).

## CI

GitHub Actions runs on every push/PR to `main`:

1. **Lint & Format** — Prettier + ESLint
2. **CI** — Type check, build, test on Node 18/20/22
3. **Website** — Build only when `website/` files changed

All jobs must pass before merging.

## Pull Requests

- All CI checks must pass
- Keep PRs focused — one feature or fix per PR
- Write tests for new functionality

## Releases

Triggered via GitHub Actions (manual dispatch):

- **`release.yml`** — publishes `@sigcli/cli` or `@sigcli/sdk` to npm
- **`release-python.yml`** — publishes `sigcli-sdk` to PyPI

Beta releases auto-increment the version. Stable releases require a clean version in `package.json` / `pyproject.toml`.

## Questions?

Open an issue or check [sigcli.ai](https://sigcli.ai).
