# signet-sdk

Lightweight Python client SDK for consuming [Signet](https://github.com/signet-auth/signet) credentials.

## Install

```bash
pip install signet-sdk
```

Requires Python >= 3.9.

## Quick start

```python
from signet_sdk import SignetClient

client = SignetClient()

# Get HTTP headers for an authenticated request
headers = client.get_headers("my-jira")
response = requests.get("https://jira.example.com/rest/api/2/search", headers=headers)
```

## Watching for changes

```python
from signet_sdk import SignetClient

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

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `credentials_dir` | `str \| Path \| None` | `~/.signet/credentials` | Path to credentials directory |

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

## Credential types

| Type | Headers produced |
|------|-----------------|
| `cookie` | `Cookie: name=value; ...` + any `xHeaders` |
| `bearer` | `Authorization: Bearer <token>` + any `xHeaders` |
| `api-key` | `<headerName>: [prefix] <key>` |
| `basic` | `Authorization: Basic <base64>` |

## License

MIT
