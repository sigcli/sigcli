import json
import re
from pathlib import Path
from typing import Optional
from .types import (ProviderFile, Credential, CookieCredential, BearerCredential,
                    ApiKeyCredential, BasicCredential, Cookie, ProviderInfo)
from .errors import CredentialNotFoundError, CredentialParseError

DEFAULT_CREDENTIALS_DIR = Path.home() / ".sig" / "credentials"

def _sanitize_id(provider_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", provider_id)

def _parse_credential(raw: dict) -> Credential:  # type: ignore[type-arg]
    cred_type = raw.get("type")
    if cred_type == "cookie":
        cookies = [Cookie(**c) for c in raw.get("cookies", [])]
        return CookieCredential(type="cookie", cookies=cookies, obtainedAt=raw["obtainedAt"],
                                xHeaders=raw.get("xHeaders", {}), localStorage=raw.get("localStorage", {}))
    elif cred_type == "bearer":
        return BearerCredential(type="bearer", accessToken=raw["accessToken"],
                                refreshToken=raw.get("refreshToken"), expiresAt=raw.get("expiresAt"),
                                scopes=raw.get("scopes"), tokenEndpoint=raw.get("tokenEndpoint"),
                                xHeaders=raw.get("xHeaders", {}), localStorage=raw.get("localStorage", {}))
    elif cred_type == "api-key":
        return ApiKeyCredential(type="api-key", key=raw["key"],
                                headerName=raw["headerName"], headerPrefix=raw.get("headerPrefix"))
    elif cred_type == "basic":
        return BasicCredential(type="basic", username=raw["username"], password=raw["password"])
    raise ValueError(f"Unknown credential type: {cred_type}")

def read_provider_file(provider_id: str, credentials_dir: Optional[Path] = None) -> ProviderFile:
    cred_dir = credentials_dir or DEFAULT_CREDENTIALS_DIR
    file_path = cred_dir / f"{_sanitize_id(provider_id)}.json"
    if not file_path.exists():
        raise CredentialNotFoundError(provider_id)
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
        credential = _parse_credential(data["credential"])
        return ProviderFile(version=data["version"], providerId=data["providerId"],
                            credential=credential, strategy=data["strategy"],
                            updatedAt=data["updatedAt"], metadata=data.get("metadata", {}))
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
            data = json.loads(fp.read_text(encoding="utf-8"))
            results.append(ProviderInfo(providerId=data["providerId"],
                                        credentialType=data["credential"]["type"],
                                        strategy=data["strategy"], updatedAt=data["updatedAt"]))
        except Exception:
            continue
    return results
