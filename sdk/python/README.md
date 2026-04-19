# signet-auth-sdk

Lightweight Python client SDK for consuming [Signet](https://github.com/signet-auth/signet) credentials.

## Install

```bash
pip install signet-auth-sdk
```

Requires Python >= 3.9.

## Quick start

```python
from signet_auth_sdk import SignetClient

client = SignetClient()

# Get HTTP headers for an authenticated request
headers = client.get_headers("my-jira")
response = requests.get("https://jira.example.com/rest/api/2/search", headers=headers)
```

## Watching for changes

```python
from signet_auth_sdk import SignetClient

client = SignetClient()

def on_change(provider_id: str, headers: dict[str, str]):
    print(f"Credentials updated for {provider_id}")

client.on_change(on_change)
client.watch()

# Later:
client.close()
```

Or use as a context manager:

```python
with SignetClient() as client:
    headers = client.get_headers("my-jira")
```

## API reference

### `SignetClient(credentials_dir=None)`

| Parameter         | Type                  | Default              | Description                   |
| ----------------- | --------------------- | -------------------- | ----------------------------- |
| `credentials_dir` | `str \| Path \| None` | `~/.sig/credentials` | Path to credentials directory |

### `client.get_headers(provider_id) -> dict[str, str]`

Returns HTTP headers ready to use with `requests`, `httpx`, etc. Raises `CredentialNotFoundError` if the provider has no stored credential.

### `client.get_credential(provider_id) -> Credential | None`

Returns the raw credential object, or `None` if not found.

### `client.get_local_storage(provider_id) -> dict[str, str]`

Returns extracted localStorage values (e.g. Slack's `xoxc` token). Empty dict if not found.

### `client.list_providers() -> list[ProviderInfo]`

Lists all providers with stored credentials.

### `client.on_change(callback)`

Register a callback for credential changes. Called with `(provider_id, headers)`.

### `client.on_error(callback)`

Register a callback for watcher errors. Called with `(error,)`.

### `client.watch()`

Start polling the credentials directory for changes.

### `client.close()`

Stop watching and clean up resources.

### `format_headers(credential) -> dict[str, str]`

Standalone function to convert a `Credential` into HTTP headers.

### `extract_local_storage(credential) -> dict[str, str]`

Standalone function to extract localStorage values from a credential.

## Return values by credential type

### `get_headers(provider_id)` -- returns `dict[str, str]`

| Credential Type | Example Return Value                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| `cookie`        | `{"Cookie": "sid=abc123; csrf=xyz789", "x-csrf-token": "tok", "origin": "https://..."}` |
| `bearer`        | `{"Authorization": "Bearer eyJhbG...", "x-csrf-token": "tok"}`                          |
| `api-key`       | `{"Authorization": "Bearer ghp_test123"}` or `{"X-API-Key": "key123"}`                  |
| `basic`         | `{"Authorization": "Basic YWRtaW46czNjcmV0"}`                                           |

For `cookie` and `bearer` types, `xHeaders` (captured during browser authentication, e.g. CSRF tokens, origin headers) are merged into the result. The primary header (`Cookie` or `Authorization`) always takes precedence over xHeaders with the same name.

### `get_credential(provider_id)` -- returns `Optional[Credential]`

Returns the full credential dataclass, discriminated by the `type` field. Returns `None` if not found.

**CookieCredential:**

```python
CookieCredential(
    type="cookie",
    cookies=[Cookie(name="sid", value="abc123", domain=".example.com", path="/", expires=1735689600, httpOnly=True, secure=True, sameSite="Lax")],
    obtainedAt="2025-01-01T00:00:00Z",
    xHeaders={"x-csrf-token": "tok123", "origin": "https://example.com"},  # default: {}
    localStorage={"token": "xoxc-123-456"},                                 # default: {}
)
```

**BearerCredential:**

```python
BearerCredential(
    type="bearer",
    accessToken="eyJhbGciOiJSUzI1NiIs...",
    refreshToken="dGhpcyBpcyBhIHJlZnJlc2g...",   # optional
    expiresAt="2025-01-02T00:00:00Z",              # optional
    scopes=["read", "write"],                       # optional
    tokenEndpoint="https://auth.example.com/token", # optional
    xHeaders={"x-csrf-token": "tok"},               # default: {}
    localStorage={"token": "xoxc-123"},             # default: {}
)
```

**ApiKeyCredential:**

```python
ApiKeyCredential(
    type="api-key",
    key="ghp_xxxxxxxxxxxxxxxxxxxx",
    headerName="Authorization",      # configurable header name
    headerPrefix="Bearer",           # optional prefix before the key
)
```

**BasicCredential:**

```python
BasicCredential(
    type="basic",
    username="admin",
    password="s3cret",
)
```

### `get_local_storage(provider_id)` -- returns `dict[str, str]`

Returns extracted browser localStorage values. Only `cookie` and `bearer` credential types can carry localStorage; `api-key` and `basic` always return `{}`. Returns `{}` if the provider is not found.

```python
# Example: Slack stores an xoxc token in localStorage alongside cookies
ls = client.get_local_storage("my-slack")
# {"token": "xoxc-123-456-789"}
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
