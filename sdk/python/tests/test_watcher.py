import time
import threading
from pathlib import Path
from sigcli_sdk.watcher import CredentialWatcher


def test_emits_change_on_file_write(tmp_path: Path):
    changes: list[str] = []
    event = threading.Event()

    def on_change(provider_id: str) -> None:
        changes.append(provider_id)
        event.set()

    watcher = CredentialWatcher(tmp_path, on_change, poll_interval=0.1)
    watcher.start()

    (tmp_path / "test-provider.json").write_text("{}")
    event.wait(timeout=2)

    assert "test-provider" in changes
    watcher.stop()


def test_detects_deletion(tmp_path: Path):
    fp = tmp_path / "to-delete.json"
    fp.write_text("{}")

    changes: list[str] = []
    event = threading.Event()

    def on_change(provider_id: str) -> None:
        changes.append(provider_id)
        event.set()

    watcher = CredentialWatcher(tmp_path, on_change, poll_interval=0.1)
    watcher.start()

    # Let it pick up the initial snapshot
    time.sleep(0.2)
    fp.unlink()
    event.wait(timeout=2)

    assert "to-delete" in changes
    watcher.stop()


def test_ignores_lock_files(tmp_path: Path):
    changes: list[str] = []

    def on_change(provider_id: str) -> None:
        changes.append(provider_id)

    watcher = CredentialWatcher(tmp_path, on_change, poll_interval=0.1)
    watcher.start()

    (tmp_path / "test.json.lock").write_text("{}")
    time.sleep(0.5)

    assert changes == []
    watcher.stop()


def test_stop_cleans_up(tmp_path: Path):
    watcher = CredentialWatcher(tmp_path, lambda _: None, poll_interval=0.1)
    watcher.start()
    watcher.stop()
    assert watcher._thread is None

    # Safe to call multiple times
    watcher.stop()
    watcher.stop()


def test_start_is_idempotent(tmp_path: Path):
    watcher = CredentialWatcher(tmp_path, lambda _: None, poll_interval=0.1)
    watcher.start()
    watcher.start()  # Should not create a second thread
    watcher.stop()
