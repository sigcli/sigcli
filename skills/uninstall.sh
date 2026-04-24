#!/bin/sh
# uninstall.sh — Remove installed sigcli skills
# Wrapper around install.sh --uninstall
#
# Usage:
#   ./uninstall.sh                    # Interactive selection
#   ./uninstall.sh --skills "slack"   # Remove specific skills
#   ./uninstall.sh --agent cursor     # Remove from Cursor

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/install.sh" --uninstall "$@"
