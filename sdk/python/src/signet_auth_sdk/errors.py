from __future__ import annotations

from typing import Optional


class SignetSdkError(Exception):
    pass

class CredentialNotFoundError(SignetSdkError):
    def __init__(self, provider_id: str) -> None:
        self.provider_id = provider_id
        super().__init__(f'No credential found for provider "{provider_id}"')

class CredentialParseError(SignetSdkError):
    def __init__(self, file_path: str, cause: Optional[Exception] = None) -> None:
        self.file_path = file_path
        self.__cause__ = cause
        super().__init__(f"Failed to parse credential file: {file_path}")
