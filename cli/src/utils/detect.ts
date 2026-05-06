/**
 * Browser detection utilities.
 * Shared by CLI commands (doctor, init).
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

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
        };
        if (apps[channel] && fs.existsSync(apps[channel])) return apps[channel];
    }

    if (platform === 'linux') {
        const bins: Record<string, string> = {
            chrome: 'google-chrome',
            msedge: 'microsoft-edge',
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

    if (platform === 'win32') {
        const paths: Record<string, string[]> = {
            chrome: [
                `${process.env.PROGRAMFILES ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
                `${process.env['PROGRAMFILES(X86)'] ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
                `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
            ],
            msedge: [
                `${process.env.PROGRAMFILES ?? ''}\\Microsoft\\Edge\\Application\\msedge.exe`,
                `${process.env['PROGRAMFILES(X86)'] ?? ''}\\Microsoft\\Edge\\Application\\msedge.exe`,
                `${process.env.LOCALAPPDATA ?? ''}\\Microsoft\\Edge\\Application\\msedge.exe`,
            ],
        };
        const candidates = paths[channel];
        if (candidates) {
            for (const p of candidates) {
                if (p && fs.existsSync(p)) return p;
            }
        }
    }

    return null;
}
