from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal, Optional

@dataclass(frozen=True)
class ProviderFile:
    """On-disk credential file (v2 format)."""
    providerId: str
    strategy: str
    updatedAt: str
    values: dict[str, str] = field(default_factory=dict)
    expiresAt: Optional[str] = None
    oauth2: Optional[dict[str, str]] = None

@dataclass(frozen=True)
class ProviderInfo:
    """Lightweight provider summary."""
    providerId: str
    strategy: str
    updatedAt: str
    expiresAt: Optional[str] = None

@dataclass(frozen=True)
class ApplyRule:
    """Apply rule for template interpolation (mirrors CLI config)."""
    in_: Literal["header", "query", "body"]
    name: str
    value: str  # Template: "Bearer ${token}", "${cookie}"
    action: Optional[Literal["set", "append", "remove"]] = None

@dataclass(frozen=True)
class ApplyResult:
    """Result of applying rules to credential values."""
    headers: dict[str, str] = field(default_factory=dict)
    query: Optional[dict[str, str]] = None
    body: Optional[dict[str, str]] = None
