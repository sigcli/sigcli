# sigcli

Monorepo for Signet authentication tools.

## Packages

| Package                             | Path              | npm / PyPI                                                 |
| ----------------------------------- | ----------------- | ---------------------------------------------------------- |
| [CLI](cli/)                         | `cli/`            | [`@sigcli/cli`](https://www.npmjs.com/package/@sigcli/cli) |
| [SDK (TypeScript)](sdk/typescript/) | `sdk/typescript/` | [`@sigcli/sdk`](https://www.npmjs.com/package/@sigcli/sdk) |
| [SDK (Python)](sdk/python/)         | `sdk/python/`     | [`sigcli-sdk`](https://pypi.org/project/sigcli-sdk/)       |
| [Website](website/)                 | `website/`        | [sigcli.ai](https://sigcli.ai)                             |
| Skills                              | `skills/`         | —                                                          |

## Quick Start

```bash
# Install the CLI
npm install -g @sigcli/cli

# Authenticate
sig login https://your-service.com

# Use credentials
sig get your-service
```

## Development

```bash
pnpm install
pnpm -r build
pnpm -r test
```

## License

MIT
