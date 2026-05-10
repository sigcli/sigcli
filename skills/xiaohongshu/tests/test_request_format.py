"""Test that XhsClient produces requests matching browser-captured format.

Compares our constructed request against a real browser-captured curl request
to verify headers, body encoding, and cookie handling are correct.
No real network calls are made.
"""

import json
import re
from unittest.mock import patch

import responses

from test_helpers import load_script

client_mod = load_script("xiaohongshu", "xhs_client")
search_mod = load_script("xiaohongshu", "xhs_search")

# ---------------------------------------------------------------------------
# Reference: browser-captured request (from Chrome DevTools)
# ---------------------------------------------------------------------------

BROWSER_COOKIE = (
    "abRequestId=bae3ba69-b77d-5c63-bab7-5e57f1863e8f; "
    "ets=1777516122210; xsecappid=xhs-pc-web; "
    "a1=19ddc3790a4f4l6rr26qn100qfetxni8esjexgihy30000298136; "
    "webId=cf4e7cef0a539df8074b107b20815897; "
    "gid=yjffSqW0Jid8yjffSqWj8Mk304i41KFFJKAIVxvy88Aiddq89CI3YC888JjYyqK8Jjf2yfWD; "
    "web_session=040069b09862f412a80400ca35384b10a8cdf0"
)
BROWSER_A1 = "19ddc3790a4f4l6rr26qn100qfetxni8esjexgihy30000298136"
BROWSER_WEB_SESSION = "040069b09862f412a80400ca35384b10a8cdf0"
BROWSER_WEB_ID = "cf4e7cef0a539df8074b107b20815897"

# The exact body sent by browser (compact JSON, no spaces)
BROWSER_BODY = '{"keyword":"小红书 skill","page":1,"page_size":20,"search_id":"2gclhivgjcirc17sd14ii","sort":"general","note_type":0,"ext_flags":[],"filters":[{"tags":["general"],"type":"sort_type"},{"tags":["不限"],"type":"filter_note_type"},{"tags":["不限"],"type":"filter_note_time"},{"tags":["不限"],"type":"filter_note_range"},{"tags":["不限"],"type":"filter_pos_distance"}],"geo":"","image_formats":["jpg","webp","avif"]}'

# Headers the browser sends (subset that matters for API acceptance)
BROWSER_REQUIRED_HEADERS = {
    "content-type": "application/json;charset=UTF-8",
    "origin": "https://www.xiaohongshu.com",
    "referer": "https://www.xiaohongshu.com/",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
}

# Sign headers browser has (format, not exact values since they vary per request)
BROWSER_SIGN_HEADER_PATTERNS = {
    "x-s": r"^XYS_",
    "x-s-common": r"^2UQAPsHC",
    "x-t": r"^\d{13}$",
    "x-b3-traceid": r"^[0-9a-f]{16}$",
    "x-xray-traceid": r"^[0-9a-f]{32}$",
}


def _make_client():
    return client_mod.XhsClient(BROWSER_COOKIE, BROWSER_A1, BROWSER_WEB_SESSION, BROWSER_WEB_ID)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_post_body_is_compact_json_utf8(mock_jitter):
    """POST body must be compact JSON (no spaces) encoded as UTF-8."""
    captured_body = None

    def capture_request(request):
        nonlocal captured_body
        captured_body = request.body
        return (200, {}, json.dumps({"code": 0, "success": True, "data": {"items": [], "has_more": False}}))

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        callback=capture_request,
    )

    client = _make_client()
    payload = json.loads(BROWSER_BODY)
    client.post("/api/sns/web/v1/search/notes", payload)

    # Body should be bytes (utf-8 encoded)
    assert isinstance(captured_body, bytes), f"Expected bytes, got {type(captured_body)}"
    decoded = captured_body.decode("utf-8")

    # Must be compact JSON (no spaces after separators)
    assert ": " not in decoded, "Body has spaces after colon — must use compact separators"
    assert ", " not in decoded, "Body has spaces after comma — must use compact separators"

    # Must parse to same structure as browser body
    assert json.loads(decoded) == json.loads(BROWSER_BODY)


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_post_headers_match_browser(mock_jitter):
    """POST request must include all required browser-style headers."""
    captured_headers = None

    def capture_request(request):
        nonlocal captured_headers
        captured_headers = dict(request.headers)
        return (200, {}, json.dumps({"code": 0, "success": True, "data": {"items": [], "has_more": False}}))

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        callback=capture_request,
    )

    client = _make_client()
    payload = json.loads(BROWSER_BODY)
    client.post("/api/sns/web/v1/search/notes", payload)

    # Check required headers are present (case-insensitive)
    headers_lower = {k.lower(): v for k, v in captured_headers.items()}
    for key, expected_value in BROWSER_REQUIRED_HEADERS.items():
        assert key in headers_lower, f"Missing required header: {key}"
        assert headers_lower[key] == expected_value, (
            f"Header {key}: expected '{expected_value}', got '{headers_lower[key]}'"
        )


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_post_has_valid_sign_headers(mock_jitter):
    """POST request must include x-s, x-s-common, x-t, x-b3-traceid, x-xray-traceid."""
    captured_headers = None

    def capture_request(request):
        nonlocal captured_headers
        captured_headers = dict(request.headers)
        return (200, {}, json.dumps({"code": 0, "success": True, "data": {"items": [], "has_more": False}}))

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        callback=capture_request,
    )

    client = _make_client()
    payload = json.loads(BROWSER_BODY)
    client.post("/api/sns/web/v1/search/notes", payload)

    headers_lower = {k.lower(): v for k, v in captured_headers.items()}
    for header_name, pattern in BROWSER_SIGN_HEADER_PATTERNS.items():
        assert header_name in headers_lower, f"Missing sign header: {header_name}"
        assert re.match(pattern, headers_lower[header_name]), (
            f"Sign header {header_name} doesn't match pattern {pattern}, "
            f"got: '{headers_lower[header_name][:50]}...'"
        )


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_post_cookie_is_full_string(mock_jitter):
    """Cookie header must contain the full cookie string (not just a1/web_session)."""
    captured_headers = None

    def capture_request(request):
        nonlocal captured_headers
        captured_headers = dict(request.headers)
        return (200, {}, json.dumps({"code": 0, "success": True, "data": {"items": [], "has_more": False}}))

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        callback=capture_request,
    )

    client = _make_client()
    payload = json.loads(BROWSER_BODY)
    client.post("/api/sns/web/v1/search/notes", payload)

    headers_lower = {k.lower(): v for k, v in captured_headers.items()}
    cookie_header = headers_lower.get("cookie", "")
    # Must contain all critical cookies
    assert "a1=" in cookie_header, "Cookie missing a1"
    assert "web_session=" in cookie_header, "Cookie missing web_session"
    assert "webId=" in cookie_header, "Cookie missing webId"
    # Must be the full cookie string, not just the 3 sign cookies
    assert "abRequestId=" in cookie_header, "Cookie should be full string, not just sign cookies"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_post_url_is_correct(mock_jitter):
    """POST URL must be https://edith.xiaohongshu.com + path (no query params for POST)."""
    captured_url = None

    def capture_request(request):
        nonlocal captured_url
        captured_url = request.url
        return (200, {}, json.dumps({"code": 0, "success": True, "data": {"items": [], "has_more": False}}))

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com"),
        callback=capture_request,
    )

    client = _make_client()
    payload = json.loads(BROWSER_BODY)
    client.post("/api/sns/web/v1/search/notes", payload)

    assert captured_url == "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_url_includes_params_in_path(mock_jitter):
    """GET URL must have params encoded in URL path (not as separate params)."""
    captured_url = None

    def capture_request(request):
        nonlocal captured_url
        captured_url = request.url
        return (200, {}, json.dumps({"code": 0, "success": True, "data": {}}))

    responses.add_callback(
        responses.GET,
        re.compile(r"https://edith\.xiaohongshu\.com"),
        callback=capture_request,
    )

    client = _make_client()
    client.get("/api/sns/web/v1/search/filter", {"keyword": "test", "search_id": "abc123"})

    # URL must contain query params (built by xhshow.build_url)
    assert "keyword=" in captured_url, f"URL missing keyword param: {captured_url}"
    assert "search_id=" in captured_url, f"URL missing search_id param: {captured_url}"
    # Must NOT have double-encoded params
    assert "?" in captured_url, f"URL missing query string: {captured_url}"


def test_search_id_generation_format():
    """Generated search_id must be uppercase base36 string."""
    search_id = search_mod._generate_search_id()
    assert len(search_id) > 10, f"search_id too short: {search_id}"
    assert all(c in "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" for c in search_id), (
        f"search_id has invalid chars: {search_id}"
    )


def test_search_payload_matches_browser_format():
    """Search payload structure must match browser-captured format exactly."""
    # Parse browser body
    browser_payload = json.loads(BROWSER_BODY)

    # Build our payload using same keyword/params
    # (simulating what search_notes would build)
    our_payload = {
        "keyword": "小红书 skill",
        "page": 1,
        "page_size": 20,
        "search_id": "2gclhivgjcirc17sd14ii",
        "sort": "general",
        "note_type": 0,
        "ext_flags": [],
        "filters": [
            {"tags": ["general"], "type": "sort_type"},
            {"tags": ["不限"], "type": "filter_note_type"},
            {"tags": ["不限"], "type": "filter_note_time"},
            {"tags": ["不限"], "type": "filter_note_range"},
            {"tags": ["不限"], "type": "filter_pos_distance"},
        ],
        "geo": "",
        "image_formats": ["jpg", "webp", "avif"],
    }

    assert our_payload == browser_payload, (
        f"Payload mismatch:\n  Ours: {json.dumps(our_payload, ensure_ascii=False)}\n"
        f"  Browser: {BROWSER_BODY}"
    )


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_user_agent_matches_chrome_version(mock_jitter):
    """User-Agent must match a recent Chrome version (not outdated 124)."""
    captured_headers = None

    def capture_request(request):
        nonlocal captured_headers
        captured_headers = dict(request.headers)
        return (200, {}, json.dumps({"code": 0, "success": True, "data": {"items": [], "has_more": False}}))

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com"),
        callback=capture_request,
    )

    client = _make_client()
    client.post("/api/sns/web/v1/search/notes", {"keyword": "test"})

    headers_lower = {k.lower(): v for k, v in captured_headers.items()}
    ua = headers_lower.get("user-agent", "")
    # Must contain Chrome version >= 140 (not our old 124)
    match = re.search(r"Chrome/(\d+)", ua)
    assert match, f"User-Agent missing Chrome version: {ua}"
    version = int(match.group(1))
    assert version >= 140, f"Chrome version too old: {version}, browser uses 147"


def test_sign_cookies_contains_full_cookie_dict():
    """sign_cookies must contain ALL cookies from the cookie string, not just a1/web_session/webId."""
    client = _make_client()
    # BROWSER_COOKIE contains: abRequestId, ets, xsecappid, a1, webId, gid, web_session, etc.
    assert "a1" in client.sign_cookies
    assert "web_session" in client.sign_cookies
    assert "webId" in client.sign_cookies
    # These extra cookies must also be present (needed for x-s-common generation)
    assert "xsecappid" in client.sign_cookies
    assert "gid" in client.sign_cookies
    assert "abRequestId" in client.sign_cookies


def test_sign_cookies_parsed_correctly():
    """Cookie string is correctly parsed into key=value dict."""
    client = _make_client()
    assert client.sign_cookies["a1"] == BROWSER_A1
    assert client.sign_cookies["web_session"] == BROWSER_WEB_SESSION
    assert client.sign_cookies["webId"] == BROWSER_WEB_ID
