import threading
import time
from pathlib import Path
from typing import Callable, Optional

class CredentialWatcher:
    def __init__(self, credentials_dir: Path, on_change: Callable[[str], None],
                 on_error: Optional[Callable[[Exception], None]] = None,
                 poll_interval: float = 1.0) -> None:
        self._dir = credentials_dir
        self._on_change = on_change
        self._on_error = on_error or (lambda e: None)
        self._poll_interval = poll_interval
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._mtimes: dict[str, float] = {}

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop_event.clear()
        self._mtimes = self._snapshot()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                current = self._snapshot()
                for name, mtime in current.items():
                    if name not in self._mtimes or self._mtimes[name] != mtime:
                        self._on_change(name[:-5])
                for name in set(self._mtimes) - set(current):
                    self._on_change(name[:-5])
                self._mtimes = current
            except Exception as e:
                self._on_error(e)
            self._stop_event.wait(self._poll_interval)

    def _snapshot(self) -> dict[str, float]:
        result: dict[str, float] = {}
        if not self._dir.exists():
            return result
        for entry in self._dir.iterdir():
            if entry.suffix == ".json" and not entry.name.endswith(".lock"):
                try:
                    result[entry.name] = entry.stat().st_mtime
                except OSError:
                    pass
        return result
