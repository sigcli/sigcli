#!/bin/sh
# install.sh — Install sigcli skills for AI coding agents
# Supports: Claude Code, Cursor, Windsurf, Cline, and custom paths
#
# Usage:
#   ./install.sh                    # Auto-detect agent
#   ./install.sh --agent claude     # Specify agent
#   ./install.sh --dest ~/my/path   # Custom path
#   ./install.sh --list             # List available skills
#   ./install.sh --uninstall        # Remove installed skills

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ALL_SKILLS="sigcli-auth outlook msteams jira slack"

# --- Agent detection ---

detect_dest() {
    if [ -n "$DEST" ]; then return; fi

    case "$AGENT" in
        claude)
            DEST="$HOME/.claude/skills"
            ;;
        cursor)
            DEST="$HOME/.cursor/skills"
            ;;
        windsurf)
            DEST="$HOME/.windsurf/skills"
            ;;
        cline)
            DEST="$HOME/.cline/skills"
            ;;
        *)
            # Auto-detect: check which agent directories exist
            for dir in "$HOME/.claude" "$HOME/.cursor" "$HOME/.windsurf" "$HOME/.cline"; do
                if [ -d "$dir" ]; then
                    DEST="$dir/skills"
                    echo "Auto-detected: $(basename "$dir")"
                    return
                fi
            done
            # Default to Claude Code
            DEST="$HOME/.claude/skills"
            ;;
    esac
}

# --- Commands ---

cmd_list() {
    detect_dest
    echo "Available skills:"
    for skill in $ALL_SKILLS; do
        if [ -d "$DEST/$skill" ]; then
            echo "  $skill  [installed]"
        else
            echo "  $skill"
        fi
    done
    echo ""
    echo "Install path: $DEST"
}

cmd_install() {
    detect_dest
    selected="${SKILLS:-$ALL_SKILLS}"

    echo "Installing to $DEST ..."
    mkdir -p "$DEST"

    for skill in $selected; do
        src="$SCRIPT_DIR/$skill"
        if [ -d "$src" ]; then
            rm -rf "$DEST/$skill"
            if command -v rsync >/dev/null 2>&1; then
                rsync -a --exclude='tests/' --exclude='__pycache__/' "$src/" "$DEST/$skill/"
            else
                cp -R "$src" "$DEST/$skill"
                rm -rf "$DEST/$skill/tests" "$DEST/$skill"/__pycache__
            fi
            echo "  + $skill"
        else
            echo "  ! $skill not found, skipping"
        fi
    done

    echo "Done."
}

cmd_uninstall() {
    detect_dest
    selected="${SKILLS:-$ALL_SKILLS}"

    echo "Removing from $DEST ..."
    for skill in $selected; do
        if [ -d "$DEST/$skill" ]; then
            rm -rf "$DEST/$skill"
            echo "  - $skill"
        fi
    done

    echo "Done."
}

# --- Parse args ---

AGENT=""
DEST=""
SKILLS=""
ACTION="install"

while [ $# -gt 0 ]; do
    case "$1" in
        --agent)
            AGENT="$2"
            shift 2
            ;;
        --dest)
            DEST="$2"
            shift 2
            ;;
        --skills)
            SKILLS="$2"
            shift 2
            ;;
        --list)
            ACTION="list"
            shift
            ;;
        --uninstall)
            ACTION="uninstall"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --agent <name>     Agent: claude, cursor, windsurf, cline (auto-detected)"
            echo "  --dest <path>      Custom install path (overrides agent detection)"
            echo "  --skills <names>   Space-separated skill names (default: all)"
            echo "  --list             List available skills and install status"
            echo "  --uninstall        Remove installed skills"
            echo "  --help             Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                          # Install all skills (auto-detect agent)"
            echo "  $0 --agent cursor           # Install for Cursor"
            echo "  $0 --dest ~/.cline/skills   # Install to custom path"
            echo "  $0 --uninstall              # Remove skills"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

case "$ACTION" in
    list)      cmd_list ;;
    install)   cmd_install ;;
    uninstall) cmd_uninstall ;;
esac
