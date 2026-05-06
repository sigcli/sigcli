import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expandHome } from '../utils/path.js';

const PROXY_DIR = expandHome('~/.sig/proxy');
const STATE_FILE = join(PROXY_DIR, 'state.json');

export interface ProxyState {
    pid: number;
    port: number;
}

export async function writeState(state: ProxyState): Promise<void> {
    await mkdir(PROXY_DIR, { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify(state));
}

export async function readState(): Promise<ProxyState | null> {
    try {
        const raw = await readFile(STATE_FILE, 'utf8');
        const state = JSON.parse(raw) as ProxyState;
        if (!state.pid || !state.port) return null;
        return state;
    } catch {
        return null;
    }
}

export async function clearState(): Promise<void> {
    await unlink(STATE_FILE).catch(() => {});
    // Clean up legacy files
    await unlink(join(PROXY_DIR, 'proxy.pid')).catch(() => {});
    await unlink(join(PROXY_DIR, 'proxy.port')).catch(() => {});
}

export async function isRunning(): Promise<boolean> {
    const state = await readState();
    if (!state) return false;
    try {
        process.kill(state.pid, 0);
        return true;
    } catch {
        await clearState();
        return false;
    }
}
