# @sigcli/cli

General-purpose authentication CLI with pluggable strategies and browser adapters.

```bash
npm install -g @sigcli/cli
```

```bash
sig init                              # Create config
sig login https://jira.example.com    # Authenticate via browser SSO
sig get jira                          # Get credentials
sig request https://jira.example.com/rest/api/2/myself   # Authenticated request
```

For full documentation — commands, configuration, strategies, xHeaders, localStorage, remote setup, and AI agent integration — see the [main README](../README.md).

## License

[MIT](../LICENSE)
