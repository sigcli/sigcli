# /auth — Authenticate with external systems

You have access to the `sig` CLI for managing authentication credentials.
All commands output JSON to stdout (for parsing) and human messages to stderr.

## Commands

### Get Credential
```bash
sig get <provider-or-url> [--format json|header|value]
```
- `--format value` → just the credential string (e.g. `Bearer eyJ...`)
- `--format header` → `HeaderName: value` lines (for curl `-H`)
- `--format json` → `{ provider, credential: { type, headerName, value, xHeaders?, localStorage? } }`

### Authenticated HTTP Request
```bash
sig request <url> [--method POST] [--header "Content-Type: application/json"] [--body '{}'] [--format json|body|headers]
```
Resolves provider by URL, injects auth headers, makes the request.
- `--format body` → response body only
- `--format json` → `{ status, statusText, headers, body }`

### Login
```bash
sig login <url> [--token <token>] [--username <user> --password <pass>] [--strategy <name>]
```
Without `--token` or credentials, opens a browser for SSO.

### Status
```bash
sig status [provider] [--format json|table]
```

### Providers
```bash
sig providers [--format json|table]
```

### Logout
```bash
sig logout [provider]
```
Omit provider to clear all credentials.

### Remote Sync
```bash
sig remote list
sig remote add <name> <host> [--user <user>] [--path <path>]
sig remote remove <name>
sig sync push [remote] [--provider <id>] [--force]
sig sync pull [remote] [--provider <id>] [--force]
```

## Usage Patterns

For API calls, prefer `sig request` — it handles auth injection automatically:
```bash
sig request https://jira.example.com/rest/api/2/myself
```

To get a token for other tools:
```bash
sig get jira.example.com --format value
```

To inject into curl:
```bash
curl -H "$(sig get jira.example.com --format header)" https://jira.example.com/rest/api/2/myself
```

## Notes
- Use `--format json` when you need to parse output programmatically
- Login opens a real browser — only works on machines with a display
- Use `sync push` to copy credentials to headless remote machines
