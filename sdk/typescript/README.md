# @sigcli/sdk

Lightweight TypeScript/Node.js client SDK for consuming [sigcli](https://github.com/sigcli/sigcli) credentials.

## Install

```bash
npm install @sigcli/sdk
```

Requires Node.js >= 18.

## Quick start

```typescript
import { SigClient } from '@sigcli/sdk';

const client = new SigClient();

// Get HTTP headers for an authenticated request
const headers = await client.getHeaders('my-jira');
const res = await fetch('https://jira.example.com/rest/api/2/search', { headers });
```

## Watching for changes

```typescript
const client = new SigClient();

client.on('change', (providerId, headers) => {
    console.log(`Credentials updated for ${providerId}`);
});

client.watch();

// Later:
client.close();
```

## API reference

### `new SigClient(options?)`

| Option           | Type     | Default              | Description                   |
| ---------------- | -------- | -------------------- | ----------------------------- |
| `credentialsDir` | `string` | `~/.sig/credentials` | Path to credentials directory |

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

## Return values by credential type

### `getHeaders(providerId)` -- returns `Record<string, string>`

| Credential Type | Example Return Value                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| `cookie`        | `{ "Cookie": "sid=abc123; csrf=xyz789", "x-csrf-token": "tok", "origin": "https://..." }` |
| `bearer`        | `{ "Authorization": "Bearer eyJhbG...", "x-csrf-token": "tok" }`                          |
| `api-key`       | `{ "Authorization": "Bearer ghp_test123" }` or `{ "X-API-Key": "key123" }`                |
| `basic`         | `{ "Authorization": "Basic YWRtaW46czNjcmV0" }`                                           |

For `cookie` and `bearer` types, `xHeaders` (captured during browser authentication, e.g. CSRF tokens, origin headers) are merged into the result. The primary header (`Cookie` or `Authorization`) always takes precedence over xHeaders with the same name.

### `getCredential(providerId)` -- returns `Credential | null`

Returns the full credential object, discriminated by the `type` field. Returns `null` if not found.

**CookieCredential:**

```typescript
{
  type: "cookie",
  cookies: [{ name: "sid", value: "abc123", domain: ".example.com", path: "/", expires: 1735689600, httpOnly: true, secure: true, sameSite: "Lax" }],
  obtainedAt: "2025-01-01T00:00:00Z",
  xHeaders: { "x-csrf-token": "tok123", "origin": "https://example.com" },         // optional
  localStorage: { "token": "xoxc-123-456" }                                         // optional
}
```

**BearerCredential:**

```typescript
{
  type: "bearer",
  accessToken: "eyJhbGciOiJSUzI1NiIs...",
  refreshToken: "dGhpcyBpcyBhIHJlZnJlc2g...",    // optional
  expiresAt: "2025-01-02T00:00:00Z",               // optional
  scopes: ["read", "write"],                        // optional
  tokenEndpoint: "https://auth.example.com/token",  // optional
  xHeaders: { "x-csrf-token": "tok" },              // optional
  localStorage: { "token": "xoxc-123" }             // optional
}
```

**ApiKeyCredential:**

```typescript
{
  type: "api-key",
  key: "ghp_xxxxxxxxxxxxxxxxxxxx",
  headerName: "Authorization",      // configurable header name
  headerPrefix: "Bearer"            // optional prefix before the key
}
```

**BasicCredential:**

```typescript
{
  type: "basic",
  username: "admin",
  password: "s3cret"
}
```

### `getLocalStorage(providerId)` -- returns `Record<string, string>`

Returns extracted browser localStorage values. Only `cookie` and `bearer` credential types can carry localStorage; `api-key` and `basic` always return `{}`. Returns `{}` if the provider is not found.

```typescript
// Example: Slack stores an xoxc token in localStorage alongside cookies
const ls = await client.getLocalStorage('my-slack');
// { "token": "xoxc-123-456-789" }
```

## Credential types

| Type      | Headers produced                                 |
| --------- | ------------------------------------------------ |
| `cookie`  | `Cookie: name=value; ...` + any `xHeaders`       |
| `bearer`  | `Authorization: Bearer <token>` + any `xHeaders` |
| `api-key` | `<headerName>: [prefix] <key>`                   |
| `basic`   | `Authorization: Basic <base64>`                  |

## License

MIT
