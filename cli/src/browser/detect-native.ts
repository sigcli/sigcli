/**
 * Browser binary detection for CDP (native browser) mode.
 * Supports macOS, Windows, and Linux.
 */

import { existsSync } from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';

export interface NativeBrowserInfo {
    name: string; // "chrome" | "msedge" | "chromium"
    execPath: string; // Full path to executable
}

// ============================================================================
// Platform-specific path lists
// ============================================================================

const MACOS_CANDIDATES: NativeBrowserInfo[] = [
    {
        name: 'chrome',
        execPath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    },
    {
        name: 'msedge',
        execPath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    },
    {
        name: 'chromium',
        execPath: '/Applications/Chromium.app/Contents/MacOS/Chromium',
    },
];

const WINDOWS_CANDIDATES: NativeBrowserInfo[] = [
    {
        name: 'chrome',
        execPath: `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    },
    {
        name: 'msedge',
        execPath: `${process.env.LOCALAPPDATA ?? ''}\\Microsoft\\Edge\\Application\\msedge.exe`,
    },
    {
        name: 'chrome',
        execPath: `${process.env.PROGRAMFILES ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    },
    {
        name: 'chrome',
        execPath: `${process.env['PROGRAMFILES(X86)'] ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    },
    {
        name: 'chromium',
        execPath: `${process.env.LOCALAPPDATA ?? ''}\\Chromium\\Application\\chrome.exe`,
    },
];

const LINUX_WHICH_CANDIDATES: Array<{ name: string; bin: string }> = [
    { name: 'chrome', bin: 'google-chrome' },
    { name: 'chrome', bin: 'google-chrome-stable' },
    { name: 'msedge', bin: 'microsoft-edge' },
    { name: 'msedge', bin: 'microsoft-edge-stable' },
    { name: 'chromium', bin: 'chromium' },
    { name: 'chromium', bin: 'chromium-browser' },
];

// ============================================================================
// Detection helpers
// ============================================================================

function whichSync(bin: string): string | null {
    try {
        const result = execSync(`which ${bin} 2>/dev/null`, { encoding: 'utf-8' }).trim();
        return result.length > 0 ? result : null;
    } catch {
        return null;
    }
}

function detectLinux(): NativeBrowserInfo[] {
    const found: NativeBrowserInfo[] = [];
    for (const { name, bin } of LINUX_WHICH_CANDIDATES) {
        const execPath = whichSync(bin);
        if (execPath && !found.some((b) => b.name === name)) {
            found.push({ name, execPath });
        }
    }
    return found;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Detect all native Chromium-based browsers on the current machine.
 * Returns browsers in preference order (Chrome → Edge → Chromium).
 */
export function detectNativeBrowsers(): NativeBrowserInfo[] {
    const platform = os.platform();

    if (platform === 'darwin') {
        return MACOS_CANDIDATES.filter((b) => existsSync(b.execPath));
    }

    if (platform === 'win32') {
        return WINDOWS_CANDIDATES.filter((b) => existsSync(b.execPath));
    }

    // Linux and other Unix-like platforms
    return detectLinux();
}

/**
 * Find a single native browser to use for CDP mode.
 *
 * @param preferred - Optional browser name hint ("chrome" | "msedge" | "chromium").
 *                    If not found, falls back to any available browser.
 * @returns The first matching browser, or null if none found.
 */
export function findNativeBrowser(preferred?: string): NativeBrowserInfo | null {
    const browsers = detectNativeBrowsers();
    if (browsers.length === 0) return null;

    if (preferred) {
        const match = browsers.find((b) => b.name === preferred);
        if (match) return match;
    }

    return browsers[0];
}
