#!/usr/bin/env bash
# sync-vendor.sh — Refresh vendored Spider_XHS files in skills/xiaohongshu/vendor/
#
# Usage:
#   ./scripts/sync-vendor.sh           # latest main
#   ./scripts/sync-vendor.sh <ref>     # specific tag/commit
#
# This is run by maintainers when bumping the vendored upstream — NOT by users.
# Users get the pre-vendored files from the skills repo directly.

set -euo pipefail

UPSTREAM_REPO="https://github.com/cv-cat/Spider_XHS.git"
UPSTREAM_REF="${1:-master}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VENDOR_DIR="$SKILL_DIR/vendor"

JS_FILES=(
    xhs_main_260411.js
    xhs_rap.js
    xhs_xray.js
    xhs_xray_pack1.js
    xhs_xray_pack2.js
    xhs_a1.js
    xhs_websectiga_env.js
)

UTIL_FILES=(
    xhs_util.py
    common_util.py
    cookie_util.py
    data_util.py
    http_util.py
)

API_FILES=(
    xhs_pc_apis.py
)

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

echo "==> Cloning $UPSTREAM_REPO @ $UPSTREAM_REF"
git clone --depth 1 --branch "$UPSTREAM_REF" "$UPSTREAM_REPO" "$TMP" 2>&1 | tail -3

UPSTREAM_SHA=$(cd "$TMP" && git rev-parse HEAD)
echo "    commit: $UPSTREAM_SHA"

echo "==> Resetting $VENDOR_DIR"
rm -rf "$VENDOR_DIR"
mkdir -p "$VENDOR_DIR/static" "$VENDOR_DIR/xhs_utils" "$VENDOR_DIR/apis"

echo "==> Copying static JS files"
for f in "${JS_FILES[@]}"; do
    cp "$TMP/static/$f" "$VENDOR_DIR/static/$f"
    echo "    static/$f"
done

echo "==> Copying xhs_utils Python files"
for f in "${UTIL_FILES[@]}"; do
    cp "$TMP/xhs_utils/$f" "$VENDOR_DIR/xhs_utils/$f"
    echo "    xhs_utils/$f"
done

echo "==> Copying apis Python files"
for f in "${API_FILES[@]}"; do
    cp "$TMP/apis/$f" "$VENDOR_DIR/apis/$f"
    echo "    apis/$f"
done

echo "==> Copying package.json (npm deps for execjs)"
cp "$TMP/package.json" "$VENDOR_DIR/package.json"

echo "==> Copying LICENSE"
if [ -f "$TMP/LICENSE" ]; then
    cp "$TMP/LICENSE" "$VENDOR_DIR/LICENSE"
else
    # Spider_XHS README declares MIT but no LICENSE file in repo.
    # Write the standard MIT text with the upstream copyright.
    cat > "$VENDOR_DIR/LICENSE" <<'EOF'
MIT License

Copyright (c) cv-cat (https://github.com/cv-cat/Spider_XHS)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
fi

echo "==> Adding __init__.py files"
touch "$VENDOR_DIR/__init__.py"
touch "$VENDOR_DIR/xhs_utils/__init__.py"
touch "$VENDOR_DIR/apis/__init__.py"

echo "==> Writing UPSTREAM.md"
cat > "$VENDOR_DIR/UPSTREAM.md" <<EOF
# Vendored from Spider_XHS

- **Source**: https://github.com/cv-cat/Spider_XHS
- **License**: MIT (see ./LICENSE)
- **Commit**: $UPSTREAM_SHA
- **Ref**: $UPSTREAM_REF
- **Synced at**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## What's vendored

Minimal subset for PC public API signing & requests:

- \`static/xhs_*.js\` — JSVMP-derived signing scripts (x-s, x-t, x-s-common, x-rap-param, x-xray-traceid)
- \`xhs_utils/*.py\` — Python helpers wrapping the JS via PyExecJS
- \`apis/xhs_pc_apis.py\` — XHS_Apis class

Excluded: creator APIs (post/upload), commercial platform APIs (pugongying/qianfan), full app stack.

## Refresh

\`\`\`bash
./scripts/sync-vendor.sh           # latest main
./scripts/sync-vendor.sh <ref>     # specific tag/commit
\`\`\`
EOF

echo
echo "✓ Synced from $UPSTREAM_REPO @ $UPSTREAM_SHA"
echo "  Vendor: $VENDOR_DIR"
