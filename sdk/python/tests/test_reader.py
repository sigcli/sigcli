from __future__ import annotations

import json
import shutil
from pathlib import Path
import pytest
from sigcli_sdk.reader import read_provider_file, list_provider_files
from sigcli_sdk.errors import CredentialNotFoundError, CredentialParseError

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def copy_fixture(name: str, target_dir: Path, target_name: str | None = None) -> None:
    src = FIXTURES_DIR / name
    data = json.loads(src.read_text())
    dest = target_dir / (target_name or name)
    shutil.copy(src, dest)


def test_read_v2_browser(tmp_path: Path):
    copy_fixture("v2_browser.json", tmp_path, "my-jira.json")
    result = read_provider_file("my-jira", tmp_path)
    assert result.providerId == "my-jira"
    assert result.strategy == "browser"
    assert result.values == {"cookie": "sid=abc123; csrf=xyz789"}
    assert result.expiresAt == "2026-05-12T10:00:00.000Z"
    assert result.oauth2 is None


def test_read_v2_oauth2(tmp_path: Path):
    copy_fixture("v2_oauth2.json", tmp_path, "my-api.json")
    result = read_provider_file("my-api", tmp_path)
    assert result.providerId == "my-api"
    assert result.strategy == "oauth2"
    assert result.values == {"access_token": "eyJhbGciOiJIUzI1NiIs"}
    assert result.oauth2 == {"clientId": "client123", "clientSecret": "secret456"}


def test_read_v2_multi_value(tmp_path: Path):
    copy_fixture("v2_multi.json", tmp_path, "my-slack.json")
    result = read_provider_file("my-slack", tmp_path)
    assert result.providerId == "my-slack"
    assert result.values == {"cookie": "d=xoxd-xxx", "token": "xoxc-123-456"}
    assert result.expiresAt is None


def test_read_v1_legacy(tmp_path: Path):
    copy_fixture("v1_legacy.json", tmp_path, "legacy-provider.json")
    result = read_provider_file("legacy-provider", tmp_path)
    assert result.providerId == "legacy-provider"
    assert result.strategy == "browser"
    # v1 uses "credentials" field — should be normalized into values
    assert result.values == {"session": "abc123"}


def test_list_providers_from_v2_files(tmp_path: Path):
    for name, fname in [
        ("v2_browser.json", "my-jira.json"),
        ("v2_oauth2.json", "my-api.json"),
        ("v2_multi.json", "my-slack.json"),
    ]:
        shutil.copy(FIXTURES_DIR / name, tmp_path / fname)

    providers = list_provider_files(tmp_path)
    assert len(providers) == 3
    ids = sorted(p.providerId for p in providers)
    assert ids == ["my-api", "my-jira", "my-slack"]


def test_list_providers_includes_strategy_and_expires(tmp_path: Path):
    shutil.copy(FIXTURES_DIR / "v2_oauth2.json", tmp_path / "my-api.json")
    providers = list_provider_files(tmp_path)
    assert len(providers) == 1
    p = providers[0]
    assert p.strategy == "oauth2"
    assert p.expiresAt == "2026-05-11T11:00:00.000Z"


def test_credential_not_found_error(tmp_path: Path):
    with pytest.raises(CredentialNotFoundError):
        read_provider_file("nonexistent", tmp_path)


def test_credential_parse_error_malformed_json(tmp_path: Path):
    (tmp_path / "bad.json").write_text("not json at all")
    with pytest.raises(CredentialParseError):
        read_provider_file("bad", tmp_path)


def test_credential_parse_error_missing_provider_id(tmp_path: Path):
    (tmp_path / "incomplete.json").write_text(json.dumps({"values": {"k": "v"}}))
    with pytest.raises(CredentialParseError):
        read_provider_file("incomplete", tmp_path)


def test_list_provider_files_empty_dir(tmp_path: Path):
    result = list_provider_files(tmp_path)
    assert result == []


def test_list_provider_files_nonexistent_dir(tmp_path: Path):
    result = list_provider_files(tmp_path / "nope")
    assert result == []


def test_list_provider_files_skips_lock_files(tmp_path: Path):
    shutil.copy(FIXTURES_DIR / "v2_browser.json", tmp_path / "my-jira.json")
    (tmp_path / "my-jira.json.lock").write_text("{}")
    providers = list_provider_files(tmp_path)
    assert len(providers) == 1


def test_list_provider_files_skips_unparseable(tmp_path: Path):
    shutil.copy(FIXTURES_DIR / "v2_browser.json", tmp_path / "my-jira.json")
    (tmp_path / "bad.json").write_text("not json")
    providers = list_provider_files(tmp_path)
    assert len(providers) == 1
    assert providers[0].providerId == "my-jira"


def test_list_provider_files_skips_missing_provider_id(tmp_path: Path):
    (tmp_path / "no-id.json").write_text(json.dumps({"values": {"k": "v"}}))
    providers = list_provider_files(tmp_path)
    assert len(providers) == 0


def test_list_provider_files_skips_missing_values(tmp_path: Path):
    (tmp_path / "no-values.json").write_text(json.dumps({"providerId": "test", "strategy": "browser"}))
    providers = list_provider_files(tmp_path)
    assert len(providers) == 0
