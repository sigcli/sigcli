import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

import { BrowserTimeoutError } from '../../types/index.js';

export function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                server.close();
                reject(new Error('Could not determine free port'));
                return;
            }
            const port = addr.port;
            server.close(() => resolve(port));
        });
        server.on('error', reject);
    });
}

export async function waitForBrowserReady(port: number, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    const pollInterval = 500;

    while (Date.now() < deadline) {
        try {
            const json = await fetchJson(`http://127.0.0.1:${port}/json/version`);
            const wsUrl = json.webSocketDebuggerUrl as string | undefined;
            if (wsUrl) return wsUrl;
        } catch {
            // Browser not ready yet
        }
        await new Promise((r) => setTimeout(r, pollInterval));
    }

    throw new BrowserTimeoutError('waiting for browser CDP endpoint', timeoutMs);
}

export function fetchJson(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk: string) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data) as Record<string, unknown>);
                } catch {
                    reject(new Error(`Failed to parse JSON from ${url}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(3000, () => {
            req.destroy();
            reject(new Error(`Timeout fetching ${url}`));
        });
    });
}

export function removeSingletonLock(dataDir: string): void {
    const lockFile = path.join(dataDir, 'SingletonLock');
    try {
        fs.unlinkSync(lockFile);
    } catch {
        // Not critical
    }
}
