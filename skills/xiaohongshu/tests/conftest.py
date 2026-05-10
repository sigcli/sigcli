"""Conftest for xiaohongshu tests — mocks xhshow if not installed."""

import sys
from unittest.mock import MagicMock, patch

import pytest

# Mock xhshow if not available (it's a private package)
if "xhshow" not in sys.modules:
    try:
        import xhshow  # noqa: F401
    except ImportError:
        mock_xhshow = MagicMock()
        # CryptoConfig mock
        mock_config = MagicMock()
        mock_config.with_overrides.return_value = mock_config
        mock_xhshow.CryptoConfig.return_value = mock_config
        # Xhshow mock — sign_headers_get/post return dicts with required headers
        mock_instance = MagicMock()
        mock_instance.sign_headers_get.return_value = {
            "x-s": "XYS_test_signature",
            "x-s-common": "2UQAPsHC_test_common",
            "x-t": "1715000000000",
            "x-b3-traceid": "abcdef0123456789",
            "x-xray-traceid": "abcdef0123456789abcdef0123456789",
        }
        mock_instance.sign_headers_post.return_value = {
            "x-s": "XYS_test_signature",
            "x-s-common": "2UQAPsHC_test_common",
            "x-t": "1715000000000",
            "x-b3-traceid": "abcdef0123456789",
            "x-xray-traceid": "abcdef0123456789abcdef0123456789",
        }
        mock_instance.build_url.side_effect = lambda path, params: (
            path + "?" + "&".join(f"{k}={v}" for k, v in params.items()) if params else path
        )
        mock_xhshow.Xhshow.return_value = mock_instance
        # SessionManager mock
        mock_xhshow.SessionManager.return_value = MagicMock()
        sys.modules["xhshow"] = mock_xhshow


@pytest.fixture(autouse=True)
def mock_rap_param():
    """Mock generate_x_rap_param to avoid Node.js dependency in tests."""
    with patch("xhs_client.generate_x_rap_param", return_value="mock_rap_param_value"):
        yield
