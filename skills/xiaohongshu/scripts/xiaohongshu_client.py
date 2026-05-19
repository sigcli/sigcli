#!/usr/bin/env python3
"""Shared Xiaohongshu client for skill scripts.

Wraps the vendored Spider_XHS implementation (skills/xiaohongshu/vendor/).
Spider_XHS is bundled because XHS request signing requires Node.js +
crypto-js to generate x-s, x-t, x-s-common, x-rap-param, x-xray-traceid —
the JS files are loaded via PyExecJS at runtime.
"""

from __future__ import annotations

import contextlib
import os
import sys
from pathlib import Path
from typing import Any

# Resolve vendor/ relative to this file: scripts/ → ../vendor/
_SCRIPT_DIR = Path(__file__).resolve().parent
_VENDOR_DIR = _SCRIPT_DIR.parent / "vendor"


class XiaohongshuApiError(Exception):
    """Raised when XHS API returns failure or transport fails."""

    def __init__(self, code: str, message: str = ""):
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def error_response(code: str, message: str) -> dict:
    """Standard error envelope for JSON output."""
    return {"error": code, "message": message}


@contextlib.contextmanager
def _vendor_context():
    """Run inside vendor/ so PyExecJS can resolve `require('crypto-js')`
    from vendor/node_modules/, and so vendor.xhs_utils is importable.

    The vendor JS files use CommonJS require(), and PyExecJS shells out
    to `node` with the script piped in — so node's module resolution
    starts from the current working directory.
    """
    if not _VENDOR_DIR.is_dir():
        raise XiaohongshuApiError(
            "VENDOR_MISSING",
            f"Vendored Spider_XHS not found at {_VENDOR_DIR}. "
            "Run scripts/sync-vendor.sh to populate it.",
        )
    if not (_VENDOR_DIR / "node_modules").is_dir():
        raise XiaohongshuApiError(
            "NODE_MODULES_MISSING",
            f"node_modules missing at {_VENDOR_DIR}/node_modules. "
            f"Run: cd {_VENDOR_DIR} && npm install",
        )

    prev_cwd = os.getcwd()
    sys_path_added = False
    vendor_str = str(_VENDOR_DIR)
    if vendor_str not in sys.path:
        sys.path.insert(0, vendor_str)
        sys_path_added = True
    try:
        os.chdir(_VENDOR_DIR)
        yield
    finally:
        os.chdir(prev_cwd)
        if sys_path_added:
            try:
                sys.path.remove(vendor_str)
            except ValueError:
                pass


class XiaohongshuClient:
    """Thin wrapper around vendor.apis.xhs_pc_apis.XHS_Apis.

    Spider_XHS's XHS_Apis takes cookies as a per-call argument, not at
    construction. We hold the cookie on the client and pass it through.
    All public methods return a dict (the parsed JSON `data` from XHS),
    or raise XiaohongshuApiError.
    """

    def __init__(self, cookie: str = ""):
        self.cookie = cookie
        self._impl: Any = None  # lazy

    @classmethod
    def create(cls, cookie_arg: str | None = None) -> "XiaohongshuClient":
        """Build client from --cookie arg, falling back to SIG_XIAOHONGSHU_COOKIE."""
        cookie = cookie_arg or os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
        return cls(cookie)

    def require_cookie(self):
        if not self.cookie:
            raise XiaohongshuApiError(
                "AUTH_REQUIRED",
                "Cookie required. Run: sig login xiaohongshu",
            )

    def _ensure_impl(self):
        if self._impl is None:
            with _vendor_context():
                from apis.xhs_pc_apis import XHS_Apis  # type: ignore
                self._impl = XHS_Apis()

    @staticmethod
    def _unwrap(success: bool, msg: str, res_json: dict | None) -> dict:
        if not success:
            raise XiaohongshuApiError("API_ERROR", msg or "request failed")
        if res_json is None:
            raise XiaohongshuApiError("API_ERROR", "empty response")
        # Spider_XHS returns the full envelope {success, msg, code, data}.
        # Return just the `data` payload to match other skills' shape.
        return res_json.get("data", res_json)

    # ------------------------------------------------------------------
    # Public API methods
    # ------------------------------------------------------------------

    def search_note(
        self,
        query: str,
        *,
        page: int = 1,
        sort: int = 0,
        note_type: int = 0,
    ) -> dict:
        """Search notes by keyword.

        sort: 0=general, 1=newest, 2=most-liked, 3=most-commented, 4=most-collected
        note_type: 0=any, 1=video, 2=image
        """
        self.require_cookie()
        self._ensure_impl()
        with _vendor_context():
            return self._unwrap(
                *self._impl.search_note(query, self.cookie, page, sort, note_type)
            )

    def get_note_info(self, url: str) -> dict:
        """Get full note detail. URL format:
        https://www.xiaohongshu.com/explore/<note_id>?xsec_token=...&xsec_source=pc_search
        """
        self.require_cookie()
        self._ensure_impl()
        with _vendor_context():
            return self._unwrap(*self._impl.get_note_info(url, self.cookie))

    def get_note_comments(
        self,
        note_id: str,
        xsec_token: str,
        cursor: str = "",
    ) -> dict:
        """Get top-level comments on a note."""
        self.require_cookie()
        self._ensure_impl()
        with _vendor_context():
            return self._unwrap(
                *self._impl.get_note_out_comment(note_id, cursor, xsec_token, self.cookie)
            )

    def get_user_info(self, user_id: str) -> dict:
        """Get user profile."""
        self.require_cookie()
        self._ensure_impl()
        with _vendor_context():
            return self._unwrap(*self._impl.get_user_info(user_id, self.cookie))

    def get_user_notes(
        self,
        user_id: str,
        cursor: str = "",
        xsec_token: str = "",
        xsec_source: str = "",
    ) -> dict:
        """Get notes published by a user (one page)."""
        self.require_cookie()
        self._ensure_impl()
        with _vendor_context():
            return self._unwrap(
                *self._impl.get_user_note_info(
                    user_id, cursor, self.cookie, xsec_token, xsec_source
                )
            )

    def get_homefeed(
        self,
        category: str = "homefeed_recommend",
        cursor_score: str = "",
        refresh_type: int = 1,
        note_index: int = 0,
    ) -> dict:
        """Get home feed recommendations (one page)."""
        self.require_cookie()
        self._ensure_impl()
        with _vendor_context():
            return self._unwrap(
                *self._impl.get_homefeed_recommend(
                    category, cursor_score, refresh_type, note_index, self.cookie
                )
            )
