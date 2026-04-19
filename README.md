# Sigcli

**sig** — short for _signet_, a personal seal of authority. `sig` signs requests on your behalf: it handles browser SSO, stores tokens, and injects credentials into any command — so your tools authenticate without ever seeing secrets.

```bash
npm install -g @sigcli/cli
```

## Quick Start

```bash
sig init                                    # Create ~/.sig/config.yaml
sig login https://jira.example.com            # Authenticate via browser SSO
sig run my-jira -- curl https://jira.example.com/rest/api/2/myself
```

**Discover available environment variables:**

```bash
sig run my-jira -- env | grep SIG_
```

`sig run` is the recommended way to use credentials — they're injected as `SIG_*` env vars and never appear in your shell or logs.

## Commands

**Setup**

| Command                  | Description                               |
| ------------------------ | ----------------------------------------- |
| `sig init`               | Create `~/.sig/config.yaml` (interactive) |
| `sig doctor`             | Check environment and config              |
| `sig completion <shell>` | Shell completion (bash\|zsh\|fish)        |

**Authentication**

| Command                 | Description                  |
| ----------------------- | ---------------------------- |
| `sig login <url>`       | Authenticate via browser SSO |
| `sig logout [provider]` | Clear credentials            |

**Credentials**

| Command                            | Description                                                   |
| ---------------------------------- | ------------------------------------------------------------- |
| `sig run <provider\|url> -- <cmd>` | **Run command with credentials injected as `SIG_*` env vars** |
| `sig request <url>`                | Make an authenticated HTTP request                            |
| `sig status [provider]`            | Show auth status                                              |
| `sig get <provider\|url>`          | Get raw credential headers                                    |

**Provider management**

| Command                  | Description               |
| ------------------------ | ------------------------- |
| `sig providers`          | List configured providers |
| `sig rename <old> <new>` | Rename a provider         |
| `sig remove <provider>`  | Remove a provider         |

**Remote & sync**

| Command                        | Description               |
| ------------------------------ | ------------------------- |
| `sig remote add\|remove\|list` | Manage SSH remotes        |
| `sig sync push\|pull [remote]` | Sync credentials over SSH |

**Watch**

| Command                              | Description              |
| ------------------------------------ | ------------------------ |
| `sig watch add\|remove\|list\|start` | Auto-refresh credentials |

Run `sig --help` or `sig <command> --help` for full options.

## Documentation

Full docs, configuration reference, and examples at **[sigcli.ai](https://sigcli.ai)**.

## License

[MIT](LICENSE)
