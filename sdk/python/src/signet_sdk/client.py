from __future__ import annotations
from pathlib import Path
from typing import Callable, Optional, Union
from .types import Credential, ProviderInfo
from .reader import read_provider_file, list_provider_files
from .formatter import format_headers, extract_local_storage
from .watcher import CredentialWatcher

DEFAULT_CREDENTIALS_DIR = Path.home() / ".signet" / "credentials"

class SignetClient:
    def __init__(self, credentials_dir: Optional[Union[str, Path]] = None) -> None:
        self._credentials_dir = Path(credentials_dir) if credentials_dir else DEFAULT_CREDENTIALS_DIR
        self._watcher: Optional[CredentialWatcher] = None
        self._change_callbacks: list[Callable[[str, dict[str, str]], None]] = []
        self._error_callbacks: list[Callable[[Exception], None]] = []

    def get_headers(self, provider_id: str) -> dict[str, str]:
        pf = read_provider_file(provider_id, self._credentials_dir)
        return format_headers(pf.credential)

    def get_credential(self, provider_id: str) -> Optional[Credential]:
        try:
            return read_provider_file(provider_id, self._credentials_dir).credential
        except Exception:
            return None

    def get_local_storage(self, provider_id: str) -> dict[str, str]:
        try:
            return extract_local_storage(read_provider_file(provider_id, self._credentials_dir).credential)
        except Exception:
            return {}

    def list_providers(self) -> list[ProviderInfo]:
        return list_provider_files(self._credentials_dir)

    def on_change(self, callback: Callable[[str, dict[str, str]], None]) -> None:
        self._change_callbacks.append(callback)

    def on_error(self, callback: Callable[[Exception], None]) -> None:
        self._error_callbacks.append(callback)

    def watch(self) -> None:
        if self._watcher is not None:
            return
        self._watcher = CredentialWatcher(self._credentials_dir, self._handle_change, self._handle_error)
        self._watcher.start()

    def close(self) -> None:
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
