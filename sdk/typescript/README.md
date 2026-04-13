# @signet-auth/sdk

Lightweight TypeScript/Node.js client SDK for consuming [Signet](https://github.com/signet-auth/signet) credentials.

## Install

```bash
npm install @signet-auth/sdk
```

Requires Node.js >= 18.

## Quick start

```typescript
import { SignetClient } from '@signet-auth/sdk';

const client = new SignetClient();

// Get HTTP headers for an authenticated request
const headers = await client.getHeaders('my-jira');
const res = await fetch('https://jira.example.com/rest/api/2/search', { headers });
```

## Watching for changes

```typescript
const client = new SignetClient();

client.on('change', (providerId, headers) => {
  console.log(`Credentials updated for ${providerId}`);
});

client.watch();

// Later:
client.close();
```

## API reference

### `new SignetClient(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `credentialsDir` | `string` | `~/.signet/credentials` | Path to credentials directory |

### `client.getHeaders(providerId): Promise<Record<string, string>>`

Returns HTTP headers ready to use with `fetch`, `axios`, etc. Throws `CredentialNotFoundError` if the provider has no stored credential.

### `client.getCredential(providerId): Promise<Credential | null>`

Returns the raw credential object, or `null` if not found.

### `client.getLocalStorage(providerId): Promise<Record<string, string>>`

Returns extracted localStorage values (e.g. Slack's `xoxc` token). Empty object if not found.

### `client.listProviders(): Promise<ProviderInfo[]>`

Lists all providers with stored credentials.

### `client.watch(): void`

Start watching the credentials directory. Emits `'change'` events with `(providerId, headers)`.

### `client.close(): void`

Stop watching and clean up resources.

### `formatHeaders(credential): Record<string, string>`

Standalone function to convert a `Credential` into HTTP headers.

### `extractLocalStorage(credential): Record<string, string>`

Standalone function to extract localStorage values from a credential.

## Credential types

| Type | Headers produced |
|------|-----------------|
| `cookie` | `Cookie: name=value; ...` + any `xHeaders` |
| `bearer` | `Authorization: Bearer <token>` + any `xHeaders` |
| `api-key` | `<headerName>: [prefix] <key>` |
| `basic` | `Authorization: Basic <base64>` |

## License

MIT
