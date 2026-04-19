import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expandHome } from '../utils/path.js';

const PROXY_DIR = expandHome('~/.sig/proxy');
const PID_FILE = join(PROXY_DIR, 'proxy.pid');
const PORT_FILE = join(PROXY_DIR, 'proxy.port');

export interface ProxyState {
    pid: number;
    port: number;
}

export async function writeState(state: ProxyState): Promise<void> {
    await mkdir(PROXY_DIR, { recursive: true });
    await writeFile(PID_FILE, String(state.pid));
    await writeFile(PORT_FILE, String(state.port));
}

export async function readState(): Promise<ProxyState | null> {
    try {
        const pid = parseInt(await readFile(PID_FILE, 'utf8'), 10);
        const port = parseInt(await readFile(PORT_FILE, 'utf8'), 10);
        if (isNaN(pid) || isNaN(port)) return null;
        return { pid, port };
    } catch {
        return null;
    }
}

export async function clearState(): Promise<void> {
    await Promise.allSettled([unlink(PID_FILE), unlink(PORT_FILE)]);
}

export async function isRunning(): Promise<boolean> {
    const state = await readState();
    if (!state) return false;
    try {
        process.kill(state.pid, 0);
        return true;
    } catch {
        return false;
    }
}
