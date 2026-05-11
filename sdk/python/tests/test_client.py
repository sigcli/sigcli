import json
import shutil
import threading
import time
from pathlib import Path
import pytest
from sigcli_sdk.client import SigClient
from sigcli_sdk.errors import CredentialNotFoundError
from sigcli_sdk.types import ProviderFile

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def copy_fixture(name: str, target_dir: Path, target_name: str | None = None) -> None:
    src = FIXTURES_DIR / name
    data = json.loads(src.read_text())
    dest = target_dir / (target_name or name)
    shutil.copy(src, dest)
    return data


def setup_v2_fixtures(tmp_path: Path) -> None:
    for name in ["v2_browser.json", "v2_oauth2.json", "v2_multi.json"]:
        src = FIXTURES_DIR / name
        data = json.loads(src.read_text())
        dest = tmp_path / f"{data['providerId']}.json"
        shutil.copy(src, dest)


def test_get_credential_returns_provider_file(tmp_path: Path):
    setup_v2_fixtures(tmp_path)
    client = SigClient(credentials_dir=tmp_path)
    cred = client.get_credential("my-jira")
    assert isinstance(cred, ProviderFile)
    assert cred.providerId == "my-jira"
    assert cred.values == {"cookie": "sid=abc123; csrf=xyz789"}
    assert cred.expiresAt == "2026-05-12T10:00:00.000Z"
    client.close()


def test_get_credential_not_found(tmp_path: Path):
    client = SigClient(credentials_dir=tmp_path)
    with pytest.raises(CredentialNotFoundError):
        client.get_credential("nonexistent")
    client.close()


def test_list_providers_returns_provider_info(tmp_path: Path):
    setup_v2_fixtures(tmp_path)
    client = SigClient(credentials_dir=tmp_path)
    providers = client.list_providers()
    assert len(providers) == 3
    ids = sorted(p.providerId for p in providers)
    assert ids == ["my-api", "my-jira", "my-slack"]
    client.close()


def test_context_manager(tmp_path: Path):
    setup_v2_fixtures(tmp_path)
    with SigClient(credentials_dir=tmp_path) as client:
        cred = client.get_credential("my-jira")
        assert cred.providerId == "my-jira"


def test_close_multiple_times(tmp_path: Path):
    client = SigClient(credentials_dir=tmp_path)
    client.close()
    client.close()
    client.close()
    # Should not raise


def test_close_after_watch(tmp_path: Path):
    setup_v2_fixtures(tmp_path)
    client = SigClient(credentials_dir=tmp_path)
    client.watch()
    client.close()
    client.close()
    # Should not raise


def test_watch_is_idempotent(tmp_path: Path):
    setup_v2_fixtures(tmp_path)
    client = SigClient(credentials_dir=tmp_path)
    client.watch()
    client.watch()  # Should not create a second watcher
    client.close()


def test_watch_callbacks_receive_provider_id_and_provider_file(tmp_path: Path):
    received: list[tuple[str, ProviderFile]] = []
    event = threading.Event()

    def on_change(provider_id: str, pf: ProviderFile) -> None:
        received.append((provider_id, pf))
        event.set()

    client = SigClient(credentials_dir=tmp_path)
    client.on_change(on_change)
    client.watch()

    # Write a v2 file
    data = {
        "version": 2,
        "providerId": "test-watch",
        "strategy": "browser",
        "updatedAt": "2026-05-11T10:00:00.000Z",
        "values": {"cookie": "session=abc"},
    }
    (tmp_path / "test-watch.json").write_text(json.dumps(data))
    event.wait(timeout=3)

    assert len(received) >= 1
    provider_id, pf = received[0]
    assert provider_id == "test-watch"
    assert isinstance(pf, ProviderFile)
    assert pf.values == {"cookie": "session=abc"}
    client.close()
