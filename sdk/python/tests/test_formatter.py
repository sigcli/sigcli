import base64
from signet_sdk.formatter import format_headers, extract_local_storage
from signet_sdk.types import (CookieCredential, BearerCredential,
                               ApiKeyCredential, BasicCredential, Cookie)


def test_format_cookie_headers():
    cred = CookieCredential(
        type="cookie",
        cookies=[
            Cookie(name="sid", value="abc123", domain=".example.com", path="/", expires=-1, httpOnly=True, secure=True),
            Cookie(name="csrf", value="xyz789", domain=".example.com", path="/", expires=1750000000, httpOnly=False, secure=True),
        ],
        obtainedAt="2026-04-13T10:00:00.000Z",
    )
    headers = format_headers(cred)
    assert headers == {"Cookie": "sid=abc123; csrf=xyz789"}


def test_format_bearer_headers():
    cred = BearerCredential(type="bearer", accessToken="eyJhbGciOiJSUzI1NiJ9.test")
    headers = format_headers(cred)
    assert headers == {"Authorization": "Bearer eyJhbGciOiJSUzI1NiJ9.test"}


def test_format_apikey_headers_with_prefix():
    cred = ApiKeyCredential(type="api-key", key="ghp_test123456", headerName="Authorization", headerPrefix="Bearer")
    headers = format_headers(cred)
    assert headers == {"Authorization": "Bearer ghp_test123456"}


def test_format_apikey_headers_without_prefix():
    cred = ApiKeyCredential(type="api-key", key="my-raw-key", headerName="X-API-Key")
    headers = format_headers(cred)
    assert headers == {"X-API-Key": "my-raw-key"}


def test_format_basic_headers():
    cred = BasicCredential(type="basic", username="admin", password="s3cret")
    headers = format_headers(cred)
    expected = base64.b64encode(b"admin:s3cret").decode()
    assert headers == {"Authorization": f"Basic {expected}"}


def test_xheaders_merged_for_cookie():
    cred = CookieCredential(
        type="cookie",
        cookies=[Cookie(name="id_token", value="tok123", domain=".x.com", path="/", expires=-1, httpOnly=True, secure=True)],
        obtainedAt="2026-04-13T10:00:00.000Z",
        xHeaders={"x-csrf-token": "csrf-abc", "origin": "https://www.x.com"},
    )
    headers = format_headers(cred)
    assert headers["Cookie"] == "id_token=tok123"
    assert headers["x-csrf-token"] == "csrf-abc"
    assert headers["origin"] == "https://www.x.com"


def test_xheaders_merged_for_bearer():
    cred = BearerCredential(type="bearer", accessToken="tok", xHeaders={"X-Custom": "val"})
    headers = format_headers(cred)
    assert headers["Authorization"] == "Bearer tok"
    assert headers["X-Custom"] == "val"


def test_cookie_header_overwrites_xheaders_cookie():
    cred = CookieCredential(
        type="cookie",
        cookies=[Cookie(name="a", value="b", domain=".x.com", path="/", expires=-1, httpOnly=False, secure=False)],
        obtainedAt="2026-04-13T10:00:00.000Z",
        xHeaders={"Cookie": "should-be-overwritten"},
    )
    headers = format_headers(cred)
    assert headers["Cookie"] == "a=b"


def test_authorization_header_overwrites_xheaders_authorization_for_bearer():
    cred = BearerCredential(
        type="bearer",
        accessToken="real-token",
        xHeaders={"Authorization": "should-be-overwritten"},
    )
    headers = format_headers(cred)
    assert headers["Authorization"] == "Bearer real-token"


def test_format_cookie_credential_with_empty_cookies():
    cred = CookieCredential(
        type="cookie",
        cookies=[],
        obtainedAt="2026-04-13T10:00:00.000Z",
    )
    headers = format_headers(cred)
    assert headers["Cookie"] == ""


def test_format_single_cookie_no_trailing_semicolon():
    cred = CookieCredential(
        type="cookie",
        cookies=[Cookie(name="only", value="one", domain=".x.com", path="/", expires=-1, httpOnly=False, secure=False)],
        obtainedAt="2026-04-13T10:00:00.000Z",
    )
    headers = format_headers(cred)
    assert headers["Cookie"] == "only=one"
    assert ";" not in headers["Cookie"]


def test_cookie_credential_with_xheaders_and_localstorage():
    cred = CookieCredential(
        type="cookie",
        cookies=[Cookie(name="d", value="xoxd-abc", domain=".slack.com", path="/", expires=-1, httpOnly=True, secure=True)],
        obtainedAt="2026-04-13T10:00:00.000Z",
        xHeaders={"x-custom": "val"},
        localStorage={"token": "xoxc-123"},
    )
    headers = format_headers(cred)
    assert headers["Cookie"] == "d=xoxd-abc"
    assert headers["x-custom"] == "val"
    # localStorage should NOT appear in headers
    assert "token" not in headers


def test_extract_local_storage_cookie():
    cred = CookieCredential(
        type="cookie", cookies=[], obtainedAt="2026-04-13T10:00:00.000Z",
        localStorage={"token": "xoxc-123"},
    )
    assert extract_local_storage(cred) == {"token": "xoxc-123"}


def test_extract_local_storage_bearer():
    cred = BearerCredential(type="bearer", accessToken="tok", localStorage={"key": "val"})
    assert extract_local_storage(cred) == {"key": "val"}


def test_extract_local_storage_apikey():
    cred = ApiKeyCredential(type="api-key", key="k", headerName="X-Key")
    assert extract_local_storage(cred) == {}


def test_extract_local_storage_basic():
    cred = BasicCredential(type="basic", username="u", password="p")
    assert extract_local_storage(cred) == {}


def test_extract_local_storage_empty_when_undefined():
    cred = CookieCredential(type="cookie", cookies=[], obtainedAt="2026-04-13T10:00:00.000Z")
    assert extract_local_storage(cred) == {}


def test_extract_local_storage_bearer_empty_when_undefined():
    cred = BearerCredential(type="bearer", accessToken="tok")
    assert extract_local_storage(cred) == {}


def test_extract_local_storage_returns_copy():
    cred = CookieCredential(
        type="cookie", cookies=[], obtainedAt="2026-04-13T10:00:00.000Z",
        localStorage={"key": "val"},
    )
    result = extract_local_storage(cred)
    result["key"] = "mutated"
    assert cred.localStorage["key"] == "val"
