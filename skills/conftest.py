"""Shared test fixtures for sigcli skills tests."""

import pytest

from test_helpers import load_script, make_response  # noqa: F401


@pytest.fixture
def fake_cookie():
    return "JSESSIONID=abc123; SESSIONID=def456"


@pytest.fixture
def fake_bearer():
    return "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.fake.sig"
