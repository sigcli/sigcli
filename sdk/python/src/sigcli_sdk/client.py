from __future__ import annotations
from pathlib import Path
from typing import Callable, Optional, Union
from .types import Credential, ProviderInfo
from .reader import read_provider_file, list_provider_files
from .formatter import format_headers, extract_local_storage
from .watcher import CredentialWatcher

DEFAULT_CREDENTIALS_DIR = Path.home() / ".sig" / "credentials"

class SignetClient:
    """Client for reading Signet credentials from the local filesystem.

    Reads credential files written by the ``sig`` CLI and converts them into
    HTTP headers, raw credential objects, or localStorage dictionaries.

    Example::

        from sigcli_sdk import SignetClient

        client = SignetClient()
        headers = client.get_headers("my-jira")
        response = requests.get("https://jira.example.com/rest/api/2/search", headers=headers)

    Can also be used as a context manager::

        with SignetClient() as client:
            headers = client.get_headers("my-jira")
    """

    def __init__(self, credentials_dir: Optional[Union[str, Path]] = None) -> None:
        self._credentials_dir = Path(credentials_dir) if credentials_dir else DEFAULT_CREDENTIALS_DIR
        self._watcher: Optional[CredentialWatcher] = None
        self._change_callbacks: list[Callable[[str, dict[str, str]], None]] = []
        self._error_callbacks: list[Callable[[Exception], None]] = []

    def get_headers(self, provider_id: str) -> dict[str, str]:
        """Get HTTP headers for a provider, ready to use with requests/httpx.

        Returns a dict whose keys are HTTP header names and values are header
        values.  The headers produced depend on the credential type:

        - **cookie** -- ``{"Cookie": "name=value; ...", ...xHeaders}``
        - **bearer** -- ``{"Authorization": "Bearer <token>", ...xHeaders}``
        - **api-key** -- ``{"<headerName>": "[prefix] <key>"}``
        - **basic** -- ``{"Authorization": "Basic <base64>"}``

        For ``cookie`` and ``bearer`` types, any captured ``xHeaders`` (e.g.
        CSRF tokens, origin headers) are merged into the result.  The primary
        header (``Cookie`` or ``Authorization``) always takes precedence over
        xHeaders with the same name.

        Args:
            provider_id: The provider identifier (e.g. ``"my-jira"``, ``"github"``).

        Returns:
            ``dict[str, str]`` of HTTP headers.

        Raises:
            CredentialNotFoundError: If no credential file exists for the provider.
            CredentialParseError: If the credential file exists but cannot be parsed.

        Example::

            headers = client.get_headers("my-jira")
            # cookie: {"Cookie": "sid=abc; csrf=xyz", "x-csrf-token": "tok"}
            # bearer: {"Authorization": "Bearer eyJhbG..."}
            response = requests.get(url, headers=headers)
        """
        pf = read_provider_file(provider_id, self._credentials_dir)
        return format_headers(pf.credential)

    def get_credential(self, provider_id: str) -> Optional[Credential]:
        """Get the raw credential object for a provider.

        Returns the full credential dataclass with all fields, or ``None`` if
        the provider has no stored credential or the file cannot be read.  The
        returned object is one of:

        - ``CookieCredential`` -- ``type="cookie"``, ``cookies``, ``obtainedAt``,
          ``xHeaders``, ``localStorage``
        - ``BearerCredential`` -- ``type="bearer"``, ``accessToken``,
          ``refreshToken``, ``expiresAt``, ``scopes``, ``tokenEndpoint``,
          ``xHeaders``, ``localStorage``
        - ``ApiKeyCredential`` -- ``type="api-key"``, ``key``, ``headerName``,
          ``headerPrefix``
        - ``BasicCredential`` -- ``type="basic"``, ``username``, ``password``

        Args:
            provider_id: The provider identifier.

        Returns:
            The ``Credential`` object, or ``None`` if not found.

        Example::

            cred = client.get_credential("github")
            if cred and cred.type == "bearer":
                print("Token expires at:", cred.expiresAt)
        """
        try:
            return read_provider_file(provider_id, self._credentials_dir).credential
        except Exception:
            return None

    def get_local_storage(self, provider_id: str) -> dict[str, str]:
        """Get extracted localStorage values for a provider.

        Returns a dict of key-value string pairs extracted from the browser's
        localStorage during authentication.  Only ``cookie`` and ``bearer``
        credential types can carry localStorage values; ``api-key`` and
        ``basic`` always return ``{}``.

        Useful for services like Slack where an additional token (e.g. ``xoxc``)
        is stored in localStorage alongside session cookies.

        Args:
            provider_id: The provider identifier (e.g. ``"my-slack"``).

        Returns:
            ``dict[str, str]``, or ``{}`` if not found or unsupported type.

        Example::

            ls = client.get_local_storage("my-slack")
            # {"token": "xoxc-123-456"}
        """
        try:
            return extract_local_storage(read_provider_file(provider_id, self._credentials_dir).credential)
        except Exception:
            return {}

    def list_providers(self) -> list[ProviderInfo]:
        """List all providers that have credential files.

        Returns:
            A list of ``ProviderInfo`` dataclasses with ``providerId``,
            ``credentialType``, ``strategy``, and ``updatedAt`` fields.

        Example::

            for p in client.list_providers():
                print(f"{p.providerId} ({p.credentialType}) updated {p.updatedAt}")
        """
        return list_provider_files(self._credentials_dir)

    def on_change(self, callback: Callable[[str, dict[str, str]], None]) -> None:
        """Register a callback for credential changes.

        The callback receives ``(provider_id, headers)`` where ``headers``
        is the result of ``get_headers()`` for the changed provider (or ``{}``
        if reading fails).

        Args:
            callback: Function called with ``(provider_id, headers)``.
        """
        self._change_callbacks.append(callback)

    def on_error(self, callback: Callable[[Exception], None]) -> None:
        """Register a callback for watcher errors.

        Args:
            callback: Function called with ``(error,)``.
        """
        self._error_callbacks.append(callback)

    def watch(self) -> None:
        """Start polling the credentials directory for changes.

        When a credential file is created, modified, or deleted, all registered
        ``on_change`` callbacks are invoked.  Watcher errors are forwarded to
        ``on_error`` callbacks.

        Safe to call multiple times; subsequent calls are no-ops.
        """
        if self._watcher is not None:
            return
        self._watcher = CredentialWatcher(self._credentials_dir, self._handle_change, self._handle_error)
        self._watcher.start()

    def close(self) -> None:
        """Stop watching and clean up resources.

        Safe to call multiple times.  After calling ``close()``, the client
        can be restarted by calling ``watch()`` again.
        """
        if self._watcher:
            self._watcher.stop()
            self._watcher = None

    def _handle_change(self, provider_id: str) -> None:
        try:
            headers = self.get_headers(provider_id)
        except Exception:
            headers = {}
        for cb in self._change_callbacks:
            try:
                cb(provider_id, headers)
            except Exception:
                pass

    def _handle_error(self, error: Exception) -> None:
        for cb in self._error_callbacks:
            try:
                cb(error)
            except Exception:
                pass

    def __enter__(self) -> SignetClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
