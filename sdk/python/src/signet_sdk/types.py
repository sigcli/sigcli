from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Literal, Optional, Sequence, Union

@dataclass(frozen=True)
class Cookie:
    name: str
    value: str
    domain: str
    path: str
    expires: float
    httpOnly: bool
    secure: bool
    sameSite: Optional[str] = None

@dataclass(frozen=True)
class CookieCredential:
    type: Literal["cookie"]
    cookies: Sequence[Cookie]
    obtainedAt: str
    xHeaders: dict[str, str] = field(default_factory=dict)
    localStorage: dict[str, str] = field(default_factory=dict)

@dataclass(frozen=True)
class BearerCredential:
    type: Literal["bearer"]
    accessToken: str
    refreshToken: Optional[str] = None
    expiresAt: Optional[str] = None
    scopes: Optional[Sequence[str]] = None
    tokenEndpoint: Optional[str] = None
    xHeaders: dict[str, str] = field(default_factory=dict)
    localStorage: dict[str, str] = field(default_factory=dict)

@dataclass(frozen=True)
class ApiKeyCredential:
    type: Literal["api-key"]
    key: str
    headerName: str
    headerPrefix: Optional[str] = None

@dataclass(frozen=True)
class BasicCredential:
    type: Literal["basic"]
    username: str
    password: str

Credential = Union[CookieCredential, BearerCredential, ApiKeyCredential, BasicCredential]

@dataclass(frozen=True)
class ProviderFile:
    version: int
    providerId: str
    credential: Credential
    strategy: str
    updatedAt: str
    metadata: dict[str, Any] = field(default_factory=dict)

@dataclass(frozen=True)
class ProviderInfo:
    providerId: str
    credentialType: str
    strategy: str
    updatedAt: str
