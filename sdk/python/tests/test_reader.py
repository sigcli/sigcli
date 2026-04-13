import json
import shutil
from pathlib import Path
import pytest
from signet_sdk.reader import read_provider_file, list_provider_files
from signet_sdk.errors import CredentialNotFoundError, CredentialParseError

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def copy_fixture(name: str, target_dir: Path, target_name: str | None = None) -> None:
    src = FIXTURES_DIR / name
    dest = target_dir / (target_name or name)
    shutil.copy(src, dest)


def test_read_cookie_provider(tmp_path: Path):
    copy_fixture("cookie-provider.json", tmp_path, "my-jira.json")
    result = read_provider_file("my-jira", tmp_path)
    assert result.version == 1
    assert result.providerId == "my-jira"
    assert result.credential.type == "cookie"
    assert len(result.credential.cookies) == 2
    assert result.credential.cookies[0].name == "sid"


def test_read_bearer_provider(tmp_path: Path):
    copy_fixture("bearer-provider.json", tmp_path, "azure-graph.json")
    result = read_provider_file("azure-graph", tmp_path)
    assert result.credential.type == "bearer"
    assert "eyJ" in result.credential.accessToken


def test_read_apikey_provider(tmp_path: Path):
    copy_fixture("apikey-provider.json", tmp_path, "github.json")
    result = read_provider_file("github", tmp_path)
    assert result.credential.type == "api-key"
    assert result.credential.key == "ghp_test123456"
    assert result.credential.headerPrefix == "Bearer"


def test_read_basic_provider(tmp_path: Path):
    copy_fixture("basic-provider.json", tmp_path, "legacy-api.json")
    result = read_provider_file("legacy-api", tmp_path)
    assert result.credential.type == "basic"
    assert result.credential.username == "admin"


def test_read_cookie_with_xheaders(tmp_path: Path):
    copy_fixture("cookie-xheaders.json", tmp_path, "xiaohongshu.json")
    result = read_provider_file("xiaohongshu", tmp_path)
    assert result.credential.type == "cookie"
    assert result.credential.xHeaders["x-csrf-token"] == "csrf-abc"


def test_read_credential_with_localstorage(tmp_path: Path):
    copy_fixture("bearer-localstorage.json", tmp_path, "slack.json")
    result = read_provider_file("slack", tmp_path)
    assert result.credential.type == "cookie"
    assert result.credential.localStorage["token"] == "xoxc-123-456"


def test_credential_not_found_error(tmp_path: Path):
    with pytest.raises(CredentialNotFoundError):
        read_provider_file("nonexistent", tmp_path)


def test_credential_parse_error_malformed_json(tmp_path: Path):
    (tmp_path / "bad.json").write_text("not json at all")
    with pytest.raises(CredentialParseError):
        read_provider_file("bad", tmp_path)


def test_credential_parse_error_missing_fields(tmp_path: Path):
    (tmp_path / "incomplete.json").write_text(json.dumps({"foo": "bar"}))
    with pytest.raises(CredentialParseError):
        read_provider_file("incomplete", tmp_path)


def test_read_apikey_provider_without_prefix(tmp_path: Path):
    copy_fixture("apikey-no-prefix.json", tmp_path, "custom-api.json")
    result = read_provider_file("custom-api", tmp_path)
    assert result.credential.type == "api-key"
    assert result.credential.key == "raw-key-no-prefix"
    assert result.credential.headerName == "X-API-Key"
    assert result.credential.headerPrefix is None


def test_credential_parse_error_partial_fields(tmp_path: Path):
    (tmp_path / "partial.json").write_text(json.dumps({"version": 1, "providerId": "partial"}))
    with pytest.raises(CredentialParseError):
        read_provider_file("partial", tmp_path)


def test_credential_parse_error_empty_json_object(tmp_path: Path):
    (tmp_path / "empty-obj.json").write_text("{}")
    with pytest.raises(CredentialParseError):
        read_provider_file("empty-obj", tmp_path)


def test_preserves_metadata_field(tmp_path: Path):
    data = {
        "version": 1,
        "providerId": "meta-test",
        "credential": {"type": "basic", "username": "u", "password": "p"},
        "strategy": "basic",
        "updatedAt": "2026-04-13T10:00:00.000Z",
        "metadata": {"source": "test"},
    }
    (tmp_path / "meta-test.json").write_text(json.dumps(data))
    result = read_provider_file("meta-test", tmp_path)
    assert result.metadata == {"source": "test"}


def test_list_provider_files(tmp_path: Path):
    copy_fixture("cookie-provider.json", tmp_path, "my-jira.json")
    copy_fixture("bearer-provider.json", tmp_path, "azure-graph.json")
    copy_fixture("apikey-provider.json", tmp_path, "github.json")

    providers = list_provider_files(tmp_path)
    assert len(providers) == 3
    ids = sorted(p.providerId for p in providers)
    assert ids == ["azure-graph", "github", "my-jira"]


def test_list_provider_files_empty_dir(tmp_path: Path):
    result = list_provider_files(tmp_path)
    assert result == []


def test_list_provider_files_nonexistent_dir(tmp_path: Path):
    result = list_provider_files(tmp_path / "nope")
    assert result == []


def test_list_provider_files_skips_lock_files(tmp_path: Path):
    copy_fixture("cookie-provider.json", tmp_path, "my-jira.json")
    (tmp_path / "my-jira.json.lock").write_text("{}")
    providers = list_provider_files(tmp_path)
    assert len(providers) == 1


def test_list_provider_files_skips_unparseable(tmp_path: Path):
    copy_fixture("cookie-provider.json", tmp_path, "good.json")
    (tmp_path / "bad.json").write_text("not json")
    providers = list_provider_files(tmp_path)
    assert len(providers) == 1
    assert providers[0].providerId == "my-jira"


def test_list_provider_files_includes_type_and_strategy(tmp_path: Path):
    copy_fixture("bearer-provider.json", tmp_path, "azure-graph.json")
    providers = list_provider_files(tmp_path)
    assert providers[0].credentialType == "bearer"
    assert providers[0].strategy == "oauth2"


def test_list_provider_files_skips_non_json(tmp_path: Path):
    copy_fixture("cookie-provider.json", tmp_path, "valid.json")
    (tmp_path / "notes.txt").write_text("just a text file")
    (tmp_path / "data.yaml").write_text("key: val")

    providers = list_provider_files(tmp_path)
    assert len(providers) == 1
    assert providers[0].providerId == "my-jira"


def test_list_provider_files_skips_missing_provider_or_credential(tmp_path: Path):
    (tmp_path / "no-provider-id.json").write_text(json.dumps({"version": 1, "credential": {"type": "basic"}}))
    (tmp_path / "no-credential.json").write_text(json.dumps({"version": 1, "providerId": "test"}))

    providers = list_provider_files(tmp_path)
    assert len(providers) == 0
