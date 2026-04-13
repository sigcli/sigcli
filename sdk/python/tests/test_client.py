import json
import shutil
from pathlib import Path
import pytest
from signet_sdk.client import SignetClient
from signet_sdk.errors import CredentialNotFoundError

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def setup_fixtures(tmp_path: Path) -> None:
    for fp in FIXTURES_DIR.glob("*.json"):
        data = json.loads(fp.read_text())
        target = tmp_path / f"{data['providerId']}.json"
        shutil.copy(fp, target)


def test_get_headers_cookie(tmp_path: Path):
    setup_fixtures(tmp_path)
    client = SignetClient(credentials_dir=tmp_path)
    headers = client.get_headers("my-jira")
    assert headers["Cookie"] == "sid=abc123; csrf=xyz789"
    client.close()


def test_get_headers_bearer(tmp_path: Path):
    setup_fixtures(tmp_path)
    client = SignetClient(credentials_dir=tmp_path)
    headers = client.get_headers("azure-graph")
    assert "Bearer eyJ" in headers["Authorization"]
    client.close()


def test_get_headers_apikey(tmp_path: Path):
    setup_fixtures(tmp_path)
    client = SignetClient(credentials_dir=tmp_path)
    headers = client.get_headers("github")
    assert headers["Authorization"] == "Bearer ghp_test123456"
    client.close()


def test_get_headers_basic(tmp_path: Path):
    setup_fixtures(tmp_path)
    client = SignetClient(credentials_dir=tmp_path)
    headers = client.get_headers("legacy-api")
    import base64
    expected = base64.b64encode(b"admin:s3cret").decode()
    assert headers["Authorization"] == f"Basic {expected}"
    client.close()


def test_get_headers_not_found(tmp_path: Path):
    client = SignetClient(credentials_dir=tmp_path)
    with pytest.raises(CredentialNotFoundError):
        client.get_headers("nonexistent")
    client.close()


def test_get_credential(tmp_path: Path):
    setup_fixtures(tmp_path)
    client = SignetClient(credentials_dir=tmp_path)
    cred = client.get_credential("my-jira")
    assert cred is not None
    assert cred.type == "cookie"
    client.close()


def test_get_credential_not_found(tmp_path: Path):
    client = SignetClient(credentials_dir=tmp_path)
    cred = client.get_credential("nonexistent")
    assert cred is None
    client.close()


def test_get_local_storage(tmp_path: Path):
    setup_fixtures(tmp_path)
    client = SignetClient(credentials_dir=tmp_path)
    ls = client.get_local_storage("slack")
    assert ls == {"token": "xoxc-123-456"}
    client.close()


def test_get_local_storage_not_found(tmp_path: Path):
    client = SignetClient(credentials_dir=tmp_path)
    ls = client.get_local_storage("nonexistent")
    assert ls == {}
    client.close()


def test_list_providers(tmp_path: Path):
    setup_fixtures(tmp_path)
    client = SignetClient(credentials_dir=tmp_path)
    providers = client.list_providers()
    assert len(providers) >= 4
    ids = sorted(p.providerId for p in providers)
    assert "my-jira" in ids
    assert "azure-graph" in ids
    assert "github" in ids
    assert "legacy-api" in ids
    client.close()


def test_context_manager(tmp_path: Path):
    setup_fixtures(tmp_path)
    with SignetClient(credentials_dir=tmp_path) as client:
        headers = client.get_headers("my-jira")
        assert "Cookie" in headers


def test_close_multiple_times(tmp_path: Path):
    client = SignetClient(credentials_dir=tmp_path)
    client.close()
    client.close()
    client.close()
    # Should not raise


def test_close_after_watch(tmp_path: Path):
    setup_fixtures(tmp_path)
    client = SignetClient(credentials_dir=tmp_path)
    client.watch()
    client.close()
    client.close()
    # Should not raise
