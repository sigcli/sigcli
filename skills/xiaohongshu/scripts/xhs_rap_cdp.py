from __future__ import annotations

import argparse
import json
from typing import Dict, List, Tuple, Optional
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

try:
    from sigcli_sdk import SigClient
except Exception:  # optional dependency
    SigClient = None  # type: ignore


def parse_cookie_str(cookie_str: str) -> List[Tuple[str, str]]:
    pairs: List[Tuple[str, str]] = []
    for part in cookie_str.split(";"):
        part = part.strip()
        if not part or "=" not in part:
            continue
        k, v = part.split("=", 1)
        pairs.append((k.strip(), v.strip()))
    return pairs


def to_playwright_cookies(cookie_str: str) -> List[Dict]:
    pairs = parse_cookie_str(cookie_str)
    domains = [".xiaohongshu.com", ".edith.xiaohongshu.com"]
    cookies = []
    for name, value in pairs:
        for domain in domains:
            cookies.append({
                "name": name,
                "value": value,
                "domain": domain,
                "path": "/",
                "httpOnly": False,
                "secure": True,
                "sameSite": "Lax",
            })
    return cookies


def get_cookie_from_sig(provider_id: str) -> str:
    if SigClient is None:
        raise RuntimeError("sigcli-sdk not installed. Run: pip install sigcli-sdk")
    client = SigClient()
    headers = client.get_headers(provider_id)
    cookie = headers.get("Cookie", "")
    if not cookie:
        raise RuntimeError(f"No Cookie header found for provider {provider_id}. Run: sig login <provider/url>")
    return cookie


def get_x_rap_param(
    api_url: str,
    cookies_str: Optional[str] = None,
    method: str = "GET",
    body: Optional[str] = None,
    user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
    ),
) -> Tuple[str, Dict[str, str]]:
    """
    Launch headless Chromium, navigate to XHS homepage, trigger a fetch to api_url in-page,
    and capture the outgoing request headers to read x-rap-param.
    Returns (x_rap_param, full_headers_dict). x_rap_param may be empty if not present.
    """
    captured_rap = {"value": ""}
    captured_headers = {"value": {}}

    target = urlparse(api_url)
    target_prefix = f"{target.scheme}://{target.netloc}{target.path}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=user_agent)

        if cookies_str:
            context.add_cookies(to_playwright_cookies(cookies_str))

        page = context.new_page()

        def on_request(req):
            if req.url.startswith(target_prefix):
                headers = req.headers
                captured_headers["value"] = headers
                captured_rap["value"] = headers.get("x-rap-param", "")

        page.on("request", on_request)

        page.goto("https://www.xiaohongshu.com/", wait_until="domcontentloaded")

        js = """
        async (url, method, body) => {
          const opts = { method, credentials: include, headers: {} };
          if (method !== GET && body) {
            opts.body = body;
            opts.headers[content-type] = application/json
