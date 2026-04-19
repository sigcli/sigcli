# SigCLI SDK

> **This repository has been deprecated.** Development has moved to [sigcli/sigcli](https://github.com/sigcli/sigcli).
>
> ```bash
> npm install @sigcli/sdk    # TypeScript
> pip install sigcli-sdk     # Python
> ```

---

Client SDKs for consuming [SigCLI](https://github.com/sigcli/sigcli) credentials in your applications.

SigCLI handles authentication via browser automation and stores credentials locally. These SDKs let your code read those credentials and use them for authenticated HTTP requests -- no browser dependency required.

## Packages

| Package                                 | Language             | Install                   |
| --------------------------------------- | -------------------- | ------------------------- |
| [`@sigcli/sdk`](./packages/typescript/) | TypeScript / Node.js | `npm install @sigcli/sdk` |
| [`sigcli-sdk`](./packages/python/)      | Python               | `pip install sigcli-sdk`  |

## How it works

1. Use the [SigCLI CLI](https://github.com/sigcli/sigcli) to authenticate (`sig login <provider>`)
2. SigCLI stores credentials as JSON files in `~/.sig/credentials/`
3. Your application uses this SDK to read credentials and get HTTP headers

## Quick example

**TypeScript:**

```typescript
import { SigClient } from '@sigcli/sdk';

const client = new SigClient();
const headers = await client.getHeaders('my-jira');
const res = await fetch('https://jira.example.com/api/search', { headers });
```

**Python:**

```python
from sigcli_sdk import SigClient

client = SigClient()
headers = client.get_headers("my-jira")
resp = requests.get("https://jira.example.com/api/search", headers=headers)
```

## License

MIT
