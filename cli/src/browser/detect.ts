/**
 * Browser detection utilities.
 * Shared by CLI commands (doctor, init).
 */

import fs from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Check whether a browser binary for the given channel exists on this machine.
 * Returns the path/name if found, or null if not.
 */
export function findChannelBrowser(channel: string): string | null {
    const platform = process.platform;

    if (platform === 'darwin') {
        const apps: Record<string, string> = {
            chrome: '/Applications/Google Chrome.app',
            msedge: '/Applications/Microsoft Edge.app',
            chromium: '/Applications/Chromium.app',
        };
        if (apps[channel] && fs.existsSync(apps[channel])) return apps[channel];
    }

    if (platform === 'linux') {
        const bins: Record<string, string> = {
            chrome: 'google-chrome',
            msedge: 'microsoft-edge',
            chromium: 'chromium',
        };
        if (bins[channel]) {
            try {
                execSync(`which ${bins[channel]}`, { stdio: 'ignore' });
                return bins[channel];
            } catch {
                return null;
            }
        }
    }

    // Windows or unknown — cannot detect, assume null
    return null;
}
