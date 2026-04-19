from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any, Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

DEFAULT_SIG_DIR = Path.home() / ".sig"
KEY_FILE = "encryption.key"


def decrypt(envelope: dict[str, Any], key: bytes) -> str:
    iv = base64.b64decode(envelope["iv"])
    auth_tag = base64.b64decode(envelope["authTag"])
    ciphertext = base64.b64decode(envelope["ciphertext"])

    aesgcm = AESGCM(key)
    # AESGCM expects ciphertext + authTag concatenated
    plaintext = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
    return plaintext.decode("utf-8")


def is_encrypted_envelope(data: Any) -> bool:
    if not isinstance(data, dict):
        return False
    return (
        data.get("encrypted") is True
        and data.get("version") == 1
        and data.get("algorithm") == "aes-256-gcm"
        and isinstance(data.get("iv"), str)
        and isinstance(data.get("authTag"), str)
        and isinstance(data.get("ciphertext"), str)
    )


def load_encryption_key(sig_dir: Optional[Path] = None) -> bytes:
    directory = sig_dir or DEFAULT_SIG_DIR
    key_path = directory / KEY_FILE

    if not key_path.exists():
        raise FileNotFoundError(
            f"Encryption key not found at {key_path}. Run 'sig init' to generate one."
        )

    raw = key_path.read_text(encoding="utf-8").strip()
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise ValueError(f"Invalid encryption key: expected 32 bytes, got {len(key)}")

    return key
