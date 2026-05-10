"""Generate x-rap-param header for Xiaohongshu GET API requests.

Uses quickjs to execute the obfuscated xhs_rap.cjs JavaScript.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import quickjs

_JS_DIR = Path(__file__).parent
_JS_CODE: str | None = None
_CTX: quickjs.Context | None = None


def _get_context() -> quickjs.Context:
    """Lazily load and compile the JS context."""
    global _JS_CODE, _CTX
    if _CTX is not None:
        return _CTX

    js_path = _JS_DIR / "xhs_rap.cjs"
    with open(js_path, "r", encoding="utf-8") as f:
        js_code = f.read()

    # quickjs has no Node.js APIs — polyfill what the JS needs
    polyfill = """
var nodeCrypto = {
    webcrypto: {
        getRandomValues: function(arr) {
            for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
            return arr;
        }
    }
};

function TextEncoder() {}
TextEncoder.prototype.encode = function(str) {
    var arr = [];
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 128) { arr.push(c); }
        else if (c < 2048) { arr.push((c >> 6) | 192); arr.push((c & 63) | 128); }
        else if (c < 65536) { arr.push((c >> 12) | 224); arr.push(((c >> 6) & 63) | 128); arr.push((c & 63) | 128); }
        else { arr.push((c >> 18) | 240); arr.push(((c >> 12) & 63) | 128); arr.push(((c >> 6) & 63) | 128); arr.push((c & 63) | 128); }
    }
    return new Uint8Array(arr);
};

function TextDecoder() {}
TextDecoder.prototype.decode = function(arr) {
    if (!arr || arr.length === 0) return '';
    var out = [], i = 0;
    while (i < arr.length) {
        var c = arr[i];
        if (c < 128) { out.push(String.fromCharCode(c)); i++; }
        else if (c < 224) { out.push(String.fromCharCode(((c & 31) << 6) | (arr[i+1] & 63))); i += 2; }
        else if (c < 240) { out.push(String.fromCharCode(((c & 15) << 12) | ((arr[i+1] & 63) << 6) | (arr[i+2] & 63))); i += 3; }
        else { i += 4; out.push('?'); }
    }
    return out.join('');
};

function URL(url) { this.href = url; this.pathname = url.split('?')[0]; this.search = url.indexOf('?') >= 0 ? '?' + url.split('?')[1] : ''; }
function URLSearchParams() {}

var __timerId = 0;
var __timers = {};
function setTimeout(fn, ms) { var id = ++__timerId; __timers[id] = fn; return id; }
function clearTimeout(id) { delete __timers[id]; }
function setInterval(fn, ms) { return setTimeout(fn, ms); }
function clearInterval(id) { clearTimeout(id); }
function requestAnimationFrame(cb) { return setTimeout(function() { cb(Date.now()); }, 16); }
var cancelAnimationFrame = clearTimeout;
"""

    # Replace require("crypto") with our polyfill
    js_code = js_code.replace('const nodeCrypto = require("crypto");', "")

    ctx = quickjs.Context()
    ctx.eval(polyfill)
    ctx.eval(js_code)
    _CTX = ctx
    return _CTX


def generate_x_rap_param(api: str, data: str = "", app_id: str | None = None) -> str:
    """Generate x-rap-param header value.

    Args:
        api: Full URI with query params (e.g. "/api/sns/web/v1/user_posted?num=30&user_id=xxx")
        data: Request body (empty string for GET requests)
        app_id: Optional app identifier (defaults to "xhs-pc-web" inside JS)

    Returns:
        Base64-encoded x-rap-param string
    """
    ctx = _get_context()
    # Escape strings for JS
    api_escaped = api.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
    data_escaped = data.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")

    if app_id:
        app_id_escaped = app_id.replace("\\", "\\\\").replace("'", "\\'")
        js_call = f"generate_x_rap_param('{api_escaped}', '{data_escaped}', '{app_id_escaped}')"
    else:
        js_call = f"generate_x_rap_param('{api_escaped}', '{data_escaped}')"

    return ctx.eval(js_call)
