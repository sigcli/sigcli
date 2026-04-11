import os from 'node:os';
import { APP_NAME, APP_VERSION } from '../core/constants.js';

/**
 * Build a User-Agent string identifying signet.
 */
export function buildUserAgent(): string {
    const platform = os.platform();
    const arch = os.arch();
    const nodeVersion = process.version;
    return `${APP_NAME}/${APP_VERSION} (${platform}; ${arch}) Node/${nodeVersion}`;
}
