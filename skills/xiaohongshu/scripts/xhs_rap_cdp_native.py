#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native Chrome/Edge headless CDP PoC to generate valid x-rap-param (and related
headers like x-s/x-t) for Xiaohongshu API by executing real frontend logic.

- No Playwright dependency. Uses raw Chrome DevTools Protocol via websockets.
- Seeds cookies from `sig get xiaohongshu --format value --no-redaction`.
- Navigates to https://www.xiaohongshu.com/ and performs fetch(url,
  {credentials: 'include'}) within the page.
- Intercepts request at Fetch.requestPaused(Request stage) to read final headers.

Usage:
  python xhs_rap_cdp_native.py --url <API URL> [--print-headers]

Optional env:
  CHROME_PATH: override Chromium binary path

Test URL example (GET):
  https://edith.xiaohongshu.com/api/sns/web/v1/user_posted?... (as provided)
"""

import argparse
import contextlib
import json
import os
import random
import shutil
import string
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
from dataclasses import dataclass

try:
    import websockets  # type: ignore
except Exception:
    print('Installing websockets...', file=sys.stderr)
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--quiet', 'websockets'])
    import websockets  # type: ignore

import asyncio

USER_AGENT = (
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/147.0.0.0 Safari/537.36'
)

XHS_HOME = 'https://www.xiaohongshu.com/'

@dataclass
class CDPConfig:
    ws_url: str

class CDPClient:
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self._id = 0
        self._lock = asyncio.Lock()
        self._pending = {}
        self._listeners = {}
        self._recv_task = None
        self._ws = None

    async def connect(self):
        self._ws = await websockets.connect(self.ws_url, max_size=None)
        self._recv_task = asyncio.create_task(self._receiver())

    async def close(self):
        try:
            if self._ws:
                await self._ws.close()
        finally:
            if self._recv_task:
                self._recv_task.cancel()

    async def _receiver(self):
        async for msg in self._ws:
            data = json.loads(msg)
            if 'id' in data and data['id'] in self._pending:
                fut = self._pending.pop(data['id'])
                if not fut.done():
                    fut.set_result(data)
            elif 'method' in data:
                method = data['method']
                payload = data.get('params', {})
                for cb in self._listeners.get(method, []):
                    try:
                        cb(payload)
                    except Exception as e:
                        sys.stderr.write(f'Listener error for {method}: {e}\n')

    def on(self, method: str, callback):
        self._listeners.setdefault(method, []).append(callback)

    async def send(self, method: str, params=None):
        async with self._lock:
            self._id += 1
            msg_id = self._id
        fut = asyncio.get_event_loop().create_future()
        self._pending[msg_id] = fut
        payload = {'id': msg_id, 'method': method}
        if params:
            payload['params'] = params
        await self._ws.send(json.dumps(payload))
        return await fut

    async def send_session(self, session_id: str, method: str, params=None):
        async with self._lock:
            self._id += 1
            msg_id = self._id
        fut = asyncio.get_event_loop().create_future()
        self._pending[msg_id] = fut
        payload = {'id': msg_id, 'method': method, 'sessionId': session_id}
        if params:
            payload['params'] = params
        await self._ws.send(json.dumps(payload))
        return await fut


def find_chrome_binary() -> str:
    # Prefer env override
    env_path = os.environ.get('CHROME_PATH')
    if env_path and os.path.exists(env_path):
        return env_path

    candidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        shutil.which('google-chrome'),
        shutil.which('chromium'),
        shutil.which('chromium-browser'),
        shutil.which('microsoft-edge'),
    ]
    for p in candidates:
        if p and os.path.exists(p):
            return p
    raise FileNotFoundError('Chrome/Edge binary not found. Set CHROME_PATH.')


def run_sig_get_cookie() -> str:
    try:
        out = subprocess.check_output(
            ['sig', 'get', 'xiaohongshu', '--format', 'value', '--no-redaction'],
            stderr=subprocess.STDOUT,
            text=True,
        )
        return out.strip()
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f'Failed to get cookie from sig: {e.output}')


def build_cdp_cookies(raw_cookie: str):
    # Split by ';' into name=value pairs
    cookie_items = []
    for part in raw_cookie.split(';'):
        part = part.strip()
        if not part or '=' not in part:
            continue
        name, value = part.split('=', 1)
        cookie_items.append((name.strip(), value.strip()))

    # Both primary and edith subdomain
    domains = ['.xiaohongshu.com', '.edith.xiaohongshu.com']

    cdp_list = []
    for domain in domains:
        for name, value in cookie_items:
            # Skip cookie-like flags that are not simple name=value if any
            if not name:
                continue
            cdp_list.append({
                'name': name,
                'value': value,
                'domain': domain,
                'path': '/',
                'httpOnly': False,
                'secure': True,
            })
    return cdp_list


def pick_free_port() -> int:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def wait_ws_endpoint(port: int, timeout: float = 8.0) -> str:
    import urllib.request
    start = time.time()
    url = f'http://127.0.0.1:{port}/json/version'
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                ws = data.get('webSocketDebuggerUrl')
                if ws:
                    return ws
        except Exception:
            time.sleep(0.1)
    raise TimeoutError('Timed out waiting for Chrome WS endpoint')


def launch_browser(binary: str, user_data_dir: str, remote_port: int):
    args = [
        binary,
        '--headless=new',
        f'--remote-debugging-port={remote_port}',
        f'--user-data-dir={user_data_dir}',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=PrivacySandboxSettings4',
        '--hide-scrollbars',
        '--mute-audio',
    ]
    return subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


async def setup_page_and_capture(url: str, print_headers: bool, rap_js_path: str = None, watch_only: bool = False, pattern: str = None, timeout_sec: float = 15.0):
    remote_port = pick_free_port()
    user_dir = tempfile.mkdtemp(prefix='xhs_cdp_')
    binary = find_chrome_binary()

    proc = launch_browser(binary, user_dir, remote_port)
    ws_url = wait_ws_endpoint(remote_port, timeout=12.0)

    client = CDPClient(ws_url)
    await client.connect()

    # Create a new page target
    tgt = await client.send('Target.createTarget', {'url': 'about:blank'})
    target_id = tgt['result']['targetId']

    # Attach to target
    sess = await client.send('Target.attachToTarget', {'targetId': target_id, 'flatten': True})
    session_id = sess['result']['sessionId']

    # Helper bound to our session
    async def send(method, params=None):
        return await client.send_session(session_id, method, params)

    # Enable required domains
    await send('Network.enable')
    await send('Page.enable')
    await send('Runtime.enable')

    # Set UA and headers
    await send('Emulation.setUserAgentOverride', {'userAgent': USER_AGENT})
    await send('Network.setExtraHTTPHeaders', {
        'headers': {
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
    })

    # Stealth patches before any page script runs
    stealth_js = """
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = window.chrome || { runtime: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN','zh'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    const origQuery = window.navigator.permissions && window.navigator.permissions.query;
    if (origQuery) {
      window.navigator.permissions.query = (parameters) => (
        parameters && parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : origQuery(parameters)
      );
    }
    """
    await send('Page.addScriptToEvaluateOnNewDocument', {'source': stealth_js})

    # Seed cookies (set one by one for compatibility)
    raw_cookie = run_sig_get_cookie()
    cookies = build_cdp_cookies(raw_cookie)
    for ck in cookies:
        await send('Network.setCookie', ck)

    # Enable Fetch interception at Request stage
    await send('Fetch.enable', {
        'patterns': [
            {'urlPattern': '*edith.xiaohongshu.com/*', 'requestStage': 'Request'}
        ]
    })

    captured = {}
    done = asyncio.Event()

    def on_fetch_event(params):
        rid = params['requestId']
        req = params['request']
        req_url = req.get('url', '')
        headers = req.get('headers', {})
        if req_url.startswith('https://edith.xiaohongshu.com/'):
            if pattern and (pattern not in req_url):
                # Continue without capturing
                asyncio.create_task(client.send_session(session_id, 'Fetch.continueRequest', {
                    'requestId': rid
                }))
                return
            # Extract interesting headers
            wanted = ['x-rap-param', 'x-s', 'x-s-common', 'x-t']
            out = {}
            for k in wanted:
                # Headers in CDP are case-insensitive; keys may be canonicalized
                for hk, hv in headers.items():
                    if hk.lower() == k:
                        out[k] = hv
            captured['url'] = req_url
            captured['headers'] = headers
            captured['wanted'] = out
            done.set()
        # Always continue the request
        asyncio.create_task(client.send_session(session_id, 'Fetch.continueRequest', {
            'requestId': rid
        }))

    client.on('Fetch.requestPaused', on_fetch_event)

    # Try to derive a relevant SPA route to trigger the same API
    nav_url = XHS_HOME
    try:
        parsed = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(parsed.query)
        uid = (qs.get('user_id') or qs.get('userId') or [''])[0]
        if uid:
            nav_url = f'https://www.xiaohongshu.com/user/profile/{uid}'
    except Exception:
        pass

    # Navigate to initialize app context and, if possible, target page
    await send('Page.navigate', {'url': nav_url})

    # Wait a bit for scripts to load
    # Wait for load event
    await send('Runtime.evaluate', {
        'expression': "new Promise(r=>{if(document.readyState==='complete')return r(true);window.addEventListener('load',()=>r(true),{once:true});})",
        'awaitPromise': True,
        'returnByValue': True,
    })
    await asyncio.sleep(2.0)

    # Optionally inject local rap JS (contains generate_x_rap_param). Disabled by default.
    rap_val = None
    if rap_js_path and os.path.exists(rap_js_path) and not watch_only:
        with open(rap_js_path, 'r', encoding='utf-8') as f:
            rap_js = f.read()
        await send('Runtime.evaluate', {
            'expression': rap_js,
            'awaitPromise': False,
            'returnByValue': False,
        })
        # Call into helper to compute rap; this will also trigger a POST XHR
        call_js = (
            "(function(){\n" 
            "  try {\n"
            "    return generate_x_rap_param('" + url.replace("\\", "\\\\").replace("'", "\\'") + "', {}, undefined);\n"
            "  } catch (e) { return 'ERR:'+String(e); }\n"
            "})();"
        )
        res = await send('Runtime.evaluate', {
            'expression': call_js,
            'awaitPromise': True,
            'returnByValue': True,
        })
        rap_val = res.get('result', {}).get('result', {}).get('value')

    eval_res = {'result': {'result': {'value': {'skipped': True}}}}
    if not watch_only:
        # Prefer XHR to leverage site's interceptors that add x-rap-param
        xhr_js = (
            "(async () => new Promise((resolve) => {\n"
            "  try {\n"
            "    const xhr = new XMLHttpRequest();\n"
            "    xhr.open('GET', '" + url.replace("\\", "\\\\").replace("'", "\\'") + "', true);\n"
            "    xhr.withCredentials = true;\n"
            "    xhr.onreadystatechange = function() {\n"
            "      if (xhr.readyState === 4) {\n"
            "        resolve({status: xhr.status, body: String(xhr.responseText||'').slice(0,256)});\n"
            "      }\n"
            "    };\n"
            "    xhr.onerror = function(e){ resolve({status: -2, error: String(e)}); };\n"
            "    xhr.send();\n"
            "  } catch (e) { resolve({status: -1, error: String(e)}); }\n"
            "}))\n"
        )
        eval_res = await send('Runtime.evaluate', {
            'expression': xhr_js,
            'awaitPromise': True,
            'returnByValue': True,
        })

    # Wait for interception capture (or we already got it)
    try:
        await asyncio.wait_for(done.wait(), timeout=timeout_sec)
    except asyncio.TimeoutError:
        pass

    # Print results
    if print_headers:
        print('=== CDP Wanted Headers ===')
        print(json.dumps(captured.get('wanted', {}), ensure_ascii=False, indent=2))
        print('=== CDP All Headers ===')
        print(json.dumps(captured.get('headers', {}), ensure_ascii=False, indent=2))
        if rap_val is not None:
            print('=== x-rap-param (in-page) ===')
            print(rap_val)
        print('=== Eval Result (truncated body) ===')
        print(json.dumps(eval_res.get('result', {}).get('result', {}).get('value', {}), ensure_ascii=False, indent=2))
    else:
        out = captured.get('wanted', {})
        if rap_val and 'x-rap-param' not in out:
            out['x-rap-param'] = rap_val
        print(json.dumps(out, ensure_ascii=False))

    # Cleanup
    with contextlib.suppress(Exception):
        await client.close()
    with contextlib.suppress(Exception):
        proc.terminate()
    with contextlib.suppress(Exception):
        shutil.rmtree(user_dir)


def main():
    ap = argparse.ArgumentParser(description='XHS x-rap-param PoC via native CDP headless Chrome')
    ap.add_argument('--url', required=True, help='Target API URL to fetch in-page')
    ap.add_argument('--print-headers', action='store_true', help='Print all request headers')
    ap.add_argument('--rap-js', default=None, help='Path to local xhs_rap.js to inject (optional)')
    ap.add_argument('--watch-only', action='store_true', help='Do not issue fetch; only watch site requests')
    ap.add_argument('--pattern', default=None, help='Only capture requests whose URL contains this substring')
    ap.add_argument('--timeout', type=float, default=20.0, help='Wait seconds for a matching request')
    args = ap.parse_args()

    asyncio.run(setup_page_and_capture(args.url, args.print_headers, args.rap_js, args.watch_only, args.pattern, args.timeout))


if __name__ == '__main__':
    main()
