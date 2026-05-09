import os from 'node:os';
import { ProxyAgent, Socks5ProxyAgent, type Dispatcher } from 'undici';

import { APP_NAME, APP_VERSION } from '../types/index.js';

/**
 * Build a User-Agent string identifying SigCLI.
 */
export function buildUserAgent(): string {
    const platform = os.platform();
    const arch = os.arch();
    const nodeVersion = process.version;
    return `${APP_NAME}/${APP_VERSION} (${platform}; ${arch}) Node/${nodeVersion}`;
}

/**
 * Create an undici dispatcher for the given proxy URL, or undefined if no proxy.
 */
export function createProxyDispatcher(proxy: string | undefined): Dispatcher | undefined {
    if (!proxy) return undefined;
    if (proxy.startsWith('socks5://') || proxy.startsWith('socks://')) {
        return new Socks5ProxyAgent(proxy);
    }
    return new ProxyAgent(proxy);
}
