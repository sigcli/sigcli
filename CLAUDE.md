# Sigcli

Monorepo for SigCLI authentication tools. pnpm workspaces, ESM, Node >= 18.

When you make this project, do not add you as an author in commit. e.g. DO NOT add this in commit message "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

## Monorepo Structure

```
sigcli/
├── cli/           # @sigcli/cli — CLI with pluggable strategies and browser adapters
├── sdk/
│   ├── typescript/  # @sigcli/sdk — lightweight client SDK (npm)
│   └── python/      # sigcli-sdk — lightweight client SDK (PyPI)
├── website/       # sigcli.ai — TanStack Start + React 19
├── skills/        # AI agent skills using SigCLI (any language)
├── docs/          # Documentation
└── pitch/         # Pitch materials
```

## Commands

```bash
pnpm install               # Install all workspace deps
pnpm -r build              # Build all packages
pnpm -r test               # Test all packages
pnpm --filter @sigcli/cli build   # Build CLI only
pnpm --filter @sigcli/cli test    # Test CLI only
pnpm --filter @sigcli/sdk build  # Build TS SDK only
pnpm --filter website dev          # Dev server for website
```

## CLI Package (`cli/`)

### Architecture

```
bin/sig.js (entry)  ──▶  cli/main.ts (router)  ──▶  cli/commands/*
                                                             │
deps.ts (composition root) ── wires all deps via DI ────────▶ AuthManager ──▶ Strategies + Storage + Browser
                                                             │
core/ (types, interfaces, Result, errors) ── zero external deps, imported by all layers
```

- **`bin/sig.js`** — Entry point. Auto-builds if needed, delegates to CLI router.
- **`src/deps.ts`** — Composition root. Creates registries, storage, browser factory, AuthManager. No singletons.
- **`src/auth-manager.ts`** — Orchestrator. Flow: stored cred → validate → refresh → authenticate. All methods return `Result<T, AuthError>`.
- **`src/core/`** — Shared vocabulary. Zero external dependencies.
- **`src/cli/`** — CLI commands (init, doctor, get, login, request, status, logout, providers, remote, sync, watch, rename, remove, completion).
- **`src/strategies/`** — Each strategy: private class + exported `*StrategyFactory` (IAuthStrategyFactory).
- **`src/browser/adapters/`** — Browser automation. Three-class pattern: Adapter → Session → Page.
- **`src/browser/flows/`** — `runHybridFlow`, `extractOAuthTokens`, `isLoginPage`, `startHeaderCapture`.
- **`src/storage/`** — DirectoryStorage, CachedStorage, MemoryStorage.
- **`src/providers/`** — ProviderRegistry, config-loader.
- **`src/sync/`** — SyncEngine + SshTransport.
- **`src/utils/`** — JWT decode, duration parse, HTTP helpers.

### Key Interfaces

| Interface              | Location                                 | Methods                                                 |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `IAuthStrategy`        | `src/core/interfaces/auth-strategy.ts`   | `validate`, `authenticate`, `refresh`, `applyToRequest` |
| `IAuthStrategyFactory` | same file                                | `name`, `create(config)`                                |
| `IBrowserAdapter`      | `src/core/interfaces/browser-adapter.ts` | `name`, `launch(options) → IBrowserSession`             |
| `IBrowserSession`      | same file                                | `newPage`, `pages`, `close`, `isConnected`              |
| `IBrowserPage`         | same file                                | Navigation, interaction, extraction, lifecycle methods  |
| `IStorage`             | `src/core/interfaces/storage.ts`         | `get`, `set`, `delete`, `list`, `clear`                 |
| `IProviderRegistry`    | `src/core/interfaces/provider.ts`        | `resolve(url)`, `get(id)`, `list`, `register`           |

### Conventions

1. **Result pattern**: Use `ok()`, `err()`, `isOk()`, `isErr()` from `src/core/result.ts`. Never throw for expected failures.
2. **Error hierarchy**: `AuthError` subclasses in `src/core/errors.ts`.
3. **ESM imports**: Always use `.js` extension.
4. **Strategy pattern**: Private strategy class, exported Factory with `readonly name` property.
5. **CLI command pattern**: Each command in `src/cli/commands/<name>.ts`, exported as `run<Name>(positionals, flags, deps)`.
6. **Adapter pattern**: Three classes (Adapter, Session, Page). Lazy-import the browser library.
7. **Testing**: Vitest with `describe`/`it`/`expect`. `MemoryStorage` for isolation.
8. **Credential types**: Discriminated union on `type` field: `'cookie' | 'bearer' | 'api-key' | 'basic'`.
9. **Config**: `StrategyConfig = Record<string, unknown>` — parsed inside each strategy via a private `parseConfig()`.
10. **Exports**: Public API through `src/index.ts`.

### CLI Usage

```bash
sig init                   # Set up config (interactive)
sig init --remote          # Set up for headless/remote machine
sig doctor                 # Check environment and config
sig get <provider|url>     # Get credential headers
sig login <url>            # Authenticate
sig request <url>          # Make authenticated HTTP request
sig status [provider]      # Show auth status
sig logout [provider]      # Clear credentials
sig providers              # List configured providers
sig rename <old> <new>     # Rename a provider
sig remove <provider>      # Remove provider and credentials
sig remote add|remove|list # Manage remote credential stores
sig sync push|pull [remote]# Sync credentials with remote
sig watch add|remove|list|start  # Auto-refresh credentials
sig completion <shell>     # Generate shell completion (bash|zsh|fish)
```

## Extension Points

- **New strategy**: `cli/src/strategies/<name>.strategy.ts` → register in `deps.ts` → export in `index.ts`
- **New adapter**: `cli/src/browser/adapters/<name>.adapter.ts` → export in `index.ts`
- **New CLI command**: `cli/src/cli/commands/<name>.ts` → add to `cli/main.ts`

## Agent Team

This project uses a Claude Code agent team. Use `/feature`, `/fix`, `/adapter`, `/strategy` commands to orchestrate the agents: **architect** (design), **dev** (implement), **tester** (test), **reviewer** (review).

If I approved your design, go with dev agent always. When you finish the dev, hand over to tester and reviewer.
