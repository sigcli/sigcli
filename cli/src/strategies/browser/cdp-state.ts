import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';

import type { ILogger } from '../../types/index.js';
import { killProcessTree } from '../../utils/process-kill.js';
import { findFreePort, isCdpResponding, waitForBrowserReady } from './browser-lifecycle.js';
import { connectCdpWs } from './cdp-ws.js';

export interface CdpState {
    pid: number;
    port: number;
    users: number[];
    createdAt: number;
}

export interface AcquireResult {
    port: number;
    wsUrl: string;
}

const STATE_FILENAME = '.cdp-state.json';
const LOCK_FILENAME = '.cdp-state.lock';

function statePath(dataDir: string): string {
    return join(dataDir, STATE_FILENAME);
}

function lockPath(dataDir: string): string {
    return join(dataDir, LOCK_FILENAME);
}

function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function ensureDir(dataDir: string): Promise<void> {
    await mkdir(dataDir, { recursive: true });
}

async function readCdpState(dataDir: string): Promise<CdpState | null> {
    try {
        const raw = await readFile(statePath(dataDir), 'utf8');
        const state = JSON.parse(raw) as CdpState;
        if (!state.pid || !state.port) return null;
        return state;
    } catch {
        return null;
    }
}

async function writeCdpState(dataDir: string, state: CdpState): Promise<void> {
    const file = statePath(dataDir);
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2));
    await rename(tmp, file);
}

async function clearCdpState(dataDir: string): Promise<void> {
    await unlink(statePath(dataDir)).catch(() => {});
}

async function withStateLock<T>(
    dataDir: string,
    staleMs: number,
    fn: () => Promise<T>,
): Promise<T> {
    await ensureDir(dataDir);
    const lp = lockPath(dataDir);
    await writeFile(lp, '', { flag: 'a', mode: 0o600 });

    let release: (() => Promise<void>) | undefined;
    try {
        release = await lockfile.lock(lp, {
            retries: { retries: 10, minTimeout: 200, maxTimeout: 2000 },
            stale: staleMs,
        });
        return await fn();
    } finally {
        if (release) {
            await release().catch(() => {});
        }
    }
}

export async function acquireBrowser(
    dataDir: string,
    execPath: string,
    browserArgs: string[],
    timeoutMs: number,
    logger: ILogger,
    entryUrl: string,
): Promise<AcquireResult> {
    const { port, alreadyReady } = await withStateLock(dataDir, 30000, async () => {
        const state = await readCdpState(dataDir);

        if (state) {
            logger.info(
                `found CDP state: pid=${state.pid}, port=${state.port}, users=${JSON.stringify(state.users)}`,
            );
            if (isProcessAlive(state.pid)) {
                logger.info(`browser pid=${state.pid} is alive, checking CDP port ${state.port}`);
                if (await isCdpResponding(state.port)) {
                    logger.info(`reusing existing browser (pid=${state.pid}, port=${state.port})`);
                    state.users = pruneDeadUsers(state.users);
                    state.users.push(process.pid);
                    await writeCdpState(dataDir, state);
                    return { port: state.port, alreadyReady: true };
                }
                logger.info(
                    `browser alive but CDP not responding on port ${state.port}, killing pid=${state.pid}`,
                );
                killProcessTree(state.pid);
            } else {
                logger.info(`stale CDP state: pid=${state.pid} is dead, cleaning up`);
            }
            await clearCdpState(dataDir);
        }

        const port = await findFreePort();
        const args = [...browserArgs.filter((a) => !a.startsWith('--remote-debugging-port='))];
        args.unshift(`--remote-debugging-port=${port}`);

        logger.info(`spawning browser: ${execPath} (CDP port ${port})`);
        const browser = spawn(execPath, args, {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
        });

        if (!browser.pid) {
            throw new Error('Failed to spawn browser process');
        }
        browser.unref();
        logger.info(`browser spawned with pid=${browser.pid}`);

        const newState: CdpState = {
            pid: browser.pid,
            port,
            users: [process.pid],
            createdAt: Date.now(),
        };
        await writeCdpState(dataDir, newState);

        return { port, alreadyReady: false };
    });

    logger.info(`waiting for CDP ready on port ${port}`);
    const wsUrl = await waitForBrowserReady(port, timeoutMs);
    logger.info(`browser CDP ready: wsUrl=${wsUrl}`);

    if (alreadyReady) {
        await openNewTab(wsUrl, entryUrl, logger);
    }

    return { port, wsUrl };
}

async function openNewTab(wsUrl: string, url: string, logger: ILogger): Promise<void> {
    let cdp:
        | {
              send: (
                  method: string,
                  params?: Record<string, unknown>,
                  sessionId?: string,
              ) => Promise<unknown>;
              close: () => void;
          }
        | undefined;
    try {
        cdp = await connectCdpWs(wsUrl);
        await cdp.send('Target.createTarget', { url });
        logger.info(`opened new tab for ${url}`);
    } catch (e) {
        logger.warn(`failed to open new tab for ${url}: ${(e as Error).message}`);
    } finally {
        cdp?.close();
    }
}

export async function releaseBrowser(dataDir: string, logger: ILogger): Promise<void> {
    try {
        await withStateLock(dataDir, 10000, async () => {
            const state = await readCdpState(dataDir);
            if (!state) {
                logger.info(`release: no CDP state file, nothing to do`);
                return;
            }

            logger.info(
                `release: removing self (pid=${process.pid}) from users=${JSON.stringify(state.users)}`,
            );
            state.users = state.users.filter((pid) => pid !== process.pid);
            state.users = pruneDeadUsers(state.users);

            if (state.users.length > 0) {
                logger.info(
                    `release: ${state.users.length} other user(s) still active, keeping browser`,
                );
                await writeCdpState(dataDir, state);
                return;
            }

            logger.info(`release: no remaining users, killing browser pid=${state.pid}`);
            if (isProcessAlive(state.pid)) {
                killProcessTree(state.pid);
            }
            await clearCdpState(dataDir);
        });
    } catch (e) {
        logger.warn(`release: failed to acquire lock: ${(e as Error).message}`);
    }
}

function pruneDeadUsers(users: number[]): number[] {
    return users.filter((pid) => isProcessAlive(pid));
}
