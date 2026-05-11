import json
import re
from pathlib import Path
from typing import Optional
from .types import ProviderFile, ProviderInfo
from .errors import CredentialNotFoundError, CredentialParseError
from .crypto import is_encrypted_envelope, decrypt, load_encryption_key

DEFAULT_CREDENTIALS_DIR = Path.home() / ".sig" / "credentials"

_cached_key: Optional[bytes] = None

def _get_encryption_key() -> bytes:
    global _cached_key
    if _cached_key is None:
        _cached_key = load_encryption_key()
    return _cached_key

def _sanitize_id(provider_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", provider_id)

def read_provider_file(provider_id: str, credentials_dir: Optional[Path] = None) -> ProviderFile:
    cred_dir = credentials_dir or DEFAULT_CREDENTIALS_DIR
    file_path = cred_dir / f"{_sanitize_id(provider_id)}.json"
    if not file_path.exists():
        raise CredentialNotFoundError(provider_id)
    try:
        raw_text = file_path.read_text(encoding="utf-8")
        data = json.loads(raw_text)
        if is_encrypted_envelope(data):
            key = _get_encryption_key()
            data = json.loads(decrypt(data, key))
        # Normalize: support both v2 (values) and v1 (credentials) field names
        values = data.get("values") or data.get("credentials") or {}
        return ProviderFile(
            providerId=data["providerId"],
            strategy=data.get("strategy", ""),
            updatedAt=data.get("updatedAt", ""),
            values=values,
            expiresAt=data.get("expiresAt"),
            oauth2=data.get("oauth2"),
        )
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
        raise CredentialParseError(str(file_path), e) from e

def list_provider_files(credentials_dir: Optional[Path] = None) -> list[ProviderInfo]:
    cred_dir = credentials_dir or DEFAULT_CREDENTIALS_DIR
    if not cred_dir.exists():
        return []
    results: list[ProviderInfo] = []
    for fp in sorted(cred_dir.glob("*.json")):
        if fp.name.endswith(".lock"):
            continue
        try:
            raw_text = fp.read_text(encoding="utf-8")
            data = json.loads(raw_text)
            if is_encrypted_envelope(data):
                key = _get_encryption_key()
                data = json.loads(decrypt(data, key))
            if data.get("providerId") and (data.get("values") or data.get("credentials")):
                results.append(ProviderInfo(
                    providerId=data["providerId"],
                    strategy=data.get("strategy", ""),
                    updatedAt=data.get("updatedAt", ""),
                    expiresAt=data.get("expiresAt"),
                ))
        except Exception:
            continue
    return results
