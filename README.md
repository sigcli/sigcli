# Sigcli

**sig** — short for _signet_, a personal seal of authority. `sig` signs requests on your behalf: it handles browser SSO, stores tokens, and injects credentials into any command — so your tools authenticate without ever seeing secrets.

```bash
npm install -g @sigcli/cli
```

## Quick Start

```bash
sig init                                      # Create ~/.sig/config.yaml
sig login https://jira.example.com            # Authenticate via browser SSO

sig request https://jira.example.com/rest/api/2/myself                                   # Authenticated request
sig run my-jira -- bash -c 'python fetch.py --cookie "$SIG_MY_JIRA_COOKIE"'              # Credentials as env vars

# Or use a local MITM proxy — agents set HTTP_PROXY and credentials are injected transparently
sig proxy start
export HTTP_PROXY=http://127.0.0.1:7891 HTTPS_PROXY=http://127.0.0.1:7891
curl https://jira.example.com/api/me   # credentials injected by proxy, agent never sees them
```

Credentials are injected as `SIG_<PROVIDER>_*` env vars and never appear in your shell or logs. All credential files are encrypted at rest (AES-256-GCM).

## Commands

**Setup**

| Command                  | Description                                   |
| ------------------------ | --------------------------------------------- |
| `sig init`               | Create `~/.sig/config.yaml` (interactive)     |
| `sig doctor`             | Check environment, config, and encryption key |
| `sig completion <shell>` | Shell completion (bash\|zsh\|fish)            |

**Authentication**

| Command                 | Description                  |
| ----------------------- | ---------------------------- |
| `sig login <url>`       | Authenticate via browser SSO |
| `sig logout [provider]` | Clear credentials            |

**Credentials**

| Command                          | Description                                                              |
| -------------------------------- | ------------------------------------------------------------------------ |
| `sig run [provider...] -- <cmd>` | **Run command with credentials injected as `SIG_<PROVIDER>_*` env vars** |
| `sig request <url>`              | Make an authenticated HTTP request                                       |
| `sig status [provider]`          | Show auth status                                                         |
| `sig get <provider\|url>`        | Get raw credential headers                                               |

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

| Command                               | Description              |
| ------------------------------------- | ------------------------ |
| `sig watch add\|remove\|set-interval` | Auto-refresh credentials |

**Proxy**

| Command                      | Description                        |
| ---------------------------- | ---------------------------------- |
| `sig proxy start [--port N]` | Start MITM proxy daemon            |
| `sig proxy stop`             | Stop proxy daemon                  |
| `sig proxy status`           | Show proxy status                  |
| `sig proxy trust`            | Print CA cert path for trust setup |

Run `sig --help` or `sig <command> --help` for full options.

## Documentation

Full docs, configuration reference, and examples at **[sigcli.ai](https://sigcli.ai)**.

## License

[MIT](LICENSE)
