# Signet SDK

Client SDKs for consuming [Signet](https://github.com/signet-auth/signet) credentials in your applications.

Signet handles authentication via browser automation and stores credentials locally. These SDKs let your code read those credentials and use them for authenticated HTTP requests -- no browser dependency required.

## Packages

| Package | Language | Install |
|---------|----------|---------|
| [`signet-auth-sdk`](./packages/typescript/) | TypeScript / Node.js | `npm install signet-auth-sdk` |
| [`signet-auth-sdk`](./packages/python/) | Python | `pip install signet-auth-sdk` |

## How it works

1. Use the [Signet CLI](https://github.com/signet-auth/signet) to authenticate (`sig login <provider>`)
2. Signet stores credentials as JSON files in `~/.signet/credentials/`
3. Your application uses this SDK to read credentials and get HTTP headers

## Quick example

**TypeScript:**

```typescript
import { SignetClient } from 'signet-auth-sdk';

const client = new SignetClient();
const headers = await client.getHeaders('my-jira');
const res = await fetch('https://jira.example.com/api/search', { headers });
```

**Python:**

```python
from signet_auth_sdk import SignetClient

client = SignetClient()
headers = client.get_headers("my-jira")
resp = requests.get("https://jira.example.com/api/search", headers=headers)
```

## License

MIT
