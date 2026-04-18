# Signet

General-purpose authentication CLI. Authenticate via browser SSO, store tokens, and make authenticated requests to any web service.

```bash
npm install -g @sigcli/cli
```

```bash
sig init                              # Create config (interactive, detects browser)
sig login https://jira.example.com    # Authenticate via browser SSO
sig get jira                          # Get credentials as JSON
sig request https://jira.example.com/rest/api/2/myself   # Authenticated request
```

**Pluggable strategies** — cookie, OAuth2, API token, basic auth. **Browser adapters** — Playwright with headless-to-visible fallback. **Credential sync** — push/pull over SSH for headless machines. **Watch mode** — auto-refresh expiring credentials on a schedule.

## Packages

| Package                             | Path              | Registry                                                   |
| ----------------------------------- | ----------------- | ---------------------------------------------------------- |
| [CLI](cli/)                         | `cli/`            | [`@sigcli/cli`](https://www.npmjs.com/package/@sigcli/cli) |
| [SDK (TypeScript)](sdk/typescript/) | `sdk/typescript/` | [`@sigcli/sdk`](https://www.npmjs.com/package/@sigcli/sdk) |
| [SDK (Python)](sdk/python/)         | `sdk/python/`     | [`sigcli-sdk`](https://pypi.org/project/sigcli-sdk/)       |
| [Website](website/)                 | `website/`        | [sigcli.ai](https://sigcli.ai)                             |
| Skills                              | `skills/`         | —                                                          |

## SDK

Use the SDK to consume Signet credentials programmatically:

```typescript
import { SignetClient } from '@sigcli/sdk';

const client = new SignetClient();
const headers = await client.getHeaders('my-jira');
const res = await fetch('https://jira.example.com/rest/api/2/myself', { headers });
```

```python
from sigcli_sdk import SignetClient

client = SignetClient()
headers = client.get_headers("my-jira")
```

## Development

```bash
pnpm install
pnpm -r build
pnpm -r test
```

## License

MIT
