"""Shared test helpers for sigcli skills tests."""

import importlib.util
import sys
from pathlib import Path
from unittest.mock import MagicMock

PROJECT_ROOT = Path(__file__).parent


def load_script(skill: str, script: str):
    """Import a skill script as a module via importlib.

    Example: load_script("outlook", "outlook_send")
    loads outlook/scripts/outlook_send.py as a module.
    """
    script_path = PROJECT_ROOT / skill / "scripts" / f"{script}.py"
    if not script_path.exists():
        raise FileNotFoundError(f"Script not found: {script_path}")
    scripts_dir = str(script_path.parent)
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    if script in sys.modules:
        return sys.modules[script]
    spec = importlib.util.spec_from_file_location(script, script_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[script] = module
    spec.loader.exec_module(module)
    return module


def make_response(
    status_code=200, json_data=None, text="", url="https://example.com", content_type="application/json", headers=None
):
    """Create a mock requests.Response object."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.url = url
    resp.text = text or ""
    resp.headers = {"content-type": content_type, **(headers or {})}
    resp.json.return_value = json_data or {}
    resp.raise_for_status.return_value = None
    if status_code >= 400:
        from requests.exceptions import HTTPError

        resp.raise_for_status.side_effect = HTTPError(response=resp)
    return resp
