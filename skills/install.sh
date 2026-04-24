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
ALL_SKILLS="sigcli-auth outlook msteams slack v2ex zhihu"

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

prompt_select() {
    if [ ! -t 0 ] || [ ! -t 1 ]; then
        SKILLS="$ALL_SKILLS"
        return
    fi

    # Try gum for a nice interactive multi-select
    if command -v gum >/dev/null 2>&1; then
        # shellcheck disable=SC2086
        selected=$(echo "$ALL_SKILLS" | tr ' ' '\n' | \
            gum choose --no-limit --selected.foreground="green" \
                --header="Select skills to install (space to toggle, enter to confirm):" \
                --selected="$ALL_SKILLS") || true
        SKILLS=$(echo "$selected" | tr '\n' ' ' | sed 's/ *$//')
    else
        # Fallback: numbered list with comma-separated input
        echo ""
        echo "Available skills:"
        i=0
        for skill in $ALL_SKILLS; do
            i=$((i + 1))
            echo "  $i) $skill"
        done
        echo ""
        printf "Enter skill numbers to install (e.g. 1,3,5) or 'a' for all: "
        read -r choice

        case "$choice" in
            a|A|"")
                SKILLS="$ALL_SKILLS"
                ;;
            *)
                SKILLS=""
                # Split on commas and spaces
                for num in $(echo "$choice" | tr ',' ' '); do
                    j=0
                    for skill in $ALL_SKILLS; do
                        j=$((j + 1))
                        if [ "$j" = "$num" ]; then
                            SKILLS="$SKILLS $skill"
                        fi
                    done
                done
                SKILLS="${SKILLS# }"
                ;;
        esac
    fi

    if [ -z "$SKILLS" ]; then
        echo "No skills selected. Aborting."
        exit 0
    fi
}

cmd_install() {
    detect_dest
    if [ -z "$SKILLS" ]; then
        prompt_select
    fi
    selected="$SKILLS"

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

prompt_unselect() {
    if [ ! -t 0 ] || [ ! -t 1 ]; then
        SKILLS="$ALL_SKILLS"
        return
    fi

    # Collect only installed skills
    installed=""
    for skill in $ALL_SKILLS; do
        if [ -d "$DEST/$skill" ]; then
            installed="$installed $skill"
        fi
    done
    installed="${installed# }"

    if [ -z "$installed" ]; then
        echo "No skills installed at $DEST"
        exit 0
    fi

    if command -v gum >/dev/null 2>&1; then
        # shellcheck disable=SC2086
        selected=$(echo "$installed" | tr ' ' '\n' | \
            gum choose --no-limit --selected.foreground="red" \
                --header="Select skills to uninstall (space to toggle, enter to confirm):" \
                --selected="$installed") || true
        SKILLS=$(echo "$selected" | tr '\n' ' ' | sed 's/ *$//')
    else
        echo ""
        echo "Installed skills:"
        i=0
        for skill in $installed; do
            i=$((i + 1))
            echo "  $i) $skill"
        done
        echo ""
        printf "Enter skill numbers to uninstall (e.g. 1,3) or 'a' for all: "
        read -r choice

        case "$choice" in
            a|A|"")
                SKILLS="$installed"
                ;;
            *)
                SKILLS=""
                for num in $(echo "$choice" | tr ',' ' '); do
                    j=0
                    for skill in $installed; do
                        j=$((j + 1))
                        if [ "$j" = "$num" ]; then
                            SKILLS="$SKILLS $skill"
                        fi
                    done
                done
                SKILLS="${SKILLS# }"
                ;;
        esac
    fi

    if [ -z "$SKILLS" ]; then
        echo "No skills selected. Aborting."
        exit 0
    fi
}

cmd_uninstall() {
    detect_dest
    if [ -z "$SKILLS" ]; then
        prompt_unselect
    fi
    selected="$SKILLS"

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
