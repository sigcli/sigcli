from __future__ import annotations
from pathlib import Path
from typing import Callable, Optional, Union
from .types import ProviderFile, ProviderInfo
from .reader import read_provider_file, list_provider_files
from .watcher import CredentialWatcher

DEFAULT_CREDENTIALS_DIR = Path.home() / ".sig" / "credentials"

class SigClient:
    """Client for reading sigcli credentials from the local filesystem.

    Example::

        from sigcli_sdk import SigClient

        client = SigClient()
        cred = client.get_credential("my-jira")
        print(cred.values)  # {"cookie": "sid=abc; csrf=xyz"}
    """

    def __init__(self, credentials_dir: Optional[Union[str, Path]] = None) -> None:
        self._credentials_dir = Path(credentials_dir) if credentials_dir else DEFAULT_CREDENTIALS_DIR
        self._watcher: Optional[CredentialWatcher] = None
        self._change_callbacks: list[Callable[[str, ProviderFile], None]] = []
        self._error_callbacks: list[Callable[[Exception], None]] = []

    def get_credential(self, provider_id: str) -> ProviderFile:
        """Get the full credential for a provider.

        Returns a ProviderFile with all fields including the flat values map.

        Args:
            provider_id: The provider identifier (e.g. "my-jira", "github").

        Returns:
            ProviderFile with providerId, strategy, updatedAt, expiresAt, values, oauth2.

        Raises:
            CredentialNotFoundError: If no credential file exists for the provider.
            CredentialParseError: If the credential file exists but cannot be parsed.

        Example::

            cred = client.get_credential("xiaohongshu")
            print(cred.values)  # {"cookie": "a1=xxx; web_session=xxx"}
        """
        return read_provider_file(provider_id, self._credentials_dir)

    def list_providers(self) -> list[ProviderInfo]:
        """List all providers that have credential files.

        Returns:
            A list of ProviderInfo with providerId, strategy, updatedAt, expiresAt.
        """
        return list_provider_files(self._credentials_dir)

    def on_change(self, callback: Callable[[str, ProviderFile], None]) -> None:
        """Register a callback for credential changes.

        The callback receives (provider_id, provider_file).
        """
        self._change_callbacks.append(callback)

    def on_error(self, callback: Callable[[Exception], None]) -> None:
        """Register a callback for watcher errors."""
        self._error_callbacks.append(callback)

    def watch(self) -> None:
        """Start polling the credentials directory for changes."""
        if self._watcher is not None:
            return
        self._watcher = CredentialWatcher(self._credentials_dir, self._handle_change, self._handle_error)
        self._watcher.start()

    def close(self) -> None:
        """Stop watching and clean up resources."""
        if self._watcher:
            self._watcher.stop()
            self._watcher = None

    def _handle_change(self, provider_id: str) -> None:
        try:
            cred = self.get_credential(provider_id)
        except Exception:
            return
        for cb in self._change_callbacks:
            try:
                cb(provider_id, cred)
            except Exception:
                pass

    def _handle_error(self, error: Exception) -> None:
        for cb in self._error_callbacks:
            try:
                cb(error)
            except Exception:
                pass

    def __enter__(self) -> SigClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
