import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
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

        // Detect singleton rejection: if process exits within 2s, another
        // instance owns this data-dir. Find and kill the orphan, then retry.
        const earlyExit = await waitForEarlyExit(browser, 2000);
        if (earlyExit) {
            logger.info(`browser exited immediately (singleton rejection), looking for orphan`);
            const orphanPort = await findOrphanCdpPort(dataDir, logger);
            if (orphanPort && (await isCdpResponding(orphanPort))) {
                logger.info(`found orphan browser on port ${orphanPort}, reusing`);
                const orphanPid = await getPidForPort(orphanPort);
                const newState: CdpState = {
                    pid: orphanPid ?? 0,
                    port: orphanPort,
                    users: [process.pid],
                    createdAt: Date.now(),
                };
                await writeCdpState(dataDir, newState);
                return { port: orphanPort, alreadyReady: true };
            }
            // Can't find orphan's CDP port — kill anything using this data-dir
            await killOrphanByDataDir(dataDir, logger);
            // Retry spawn
            const retryPort = await findFreePort();
            const retryArgs = [
                ...browserArgs.filter((a) => !a.startsWith('--remote-debugging-port=')),
            ];
            retryArgs.unshift(`--remote-debugging-port=${retryPort}`);
            logger.info(`retrying browser spawn on port ${retryPort}`);
            const retryBrowser = spawn(execPath, retryArgs, {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
            });
            if (!retryBrowser.pid) {
                throw new Error('Failed to spawn browser process on retry');
            }
            retryBrowser.unref();
            const retryState: CdpState = {
                pid: retryBrowser.pid,
                port: retryPort,
                users: [process.pid],
                createdAt: Date.now(),
            };
            await writeCdpState(dataDir, retryState);
            return { port: retryPort, alreadyReady: false };
        }

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

function waitForEarlyExit(child: ChildProcess, ms: number): Promise<boolean> {
    return new Promise((resolve) => {
        let exited = false;
        child.on('exit', () => {
            exited = true;
            resolve(true);
        });
        setTimeout(() => {
            if (!exited) resolve(false);
        }, ms).unref();
    });
}

async function findOrphanCdpPort(dataDir: string, logger: ILogger): Promise<number | null> {
    const socketPath = join(dataDir, 'SingletonSocket');
    if (!existsSync(socketPath)) {
        logger.info(`no SingletonSocket found, orphan may have exited`);
        return null;
    }

    // Try to find the orphan's PID from lsof or wmic and parse its command line
    if (process.platform === 'win32') {
        return findOrphanPortWindows(dataDir, logger);
    }
    return findOrphanPortUnix(dataDir, logger);
}

async function findOrphanPortUnix(dataDir: string, logger: ILogger): Promise<number | null> {
    try {
        const output = execSync(
            `ps aux | grep -- '--user-data-dir=${dataDir}' | grep -- '--remote-debugging-port=' | grep -v grep`,
            { encoding: 'utf-8', timeout: 5000 },
        );
        const match = output.match(/--remote-debugging-port=(\d+)/);
        if (match) {
            const port = parseInt(match[1], 10);
            logger.info(`found orphan CDP port ${port} from process list`);
            return port;
        }
    } catch {
        // No matching process
    }
    return null;
}

async function findOrphanPortWindows(dataDir: string, logger: ILogger): Promise<number | null> {
    try {
        const output = execSync(
            `wmic process where "CommandLine like '%--user-data-dir=${dataDir.replace(/\\/g, '\\\\')}%'" get CommandLine /format:list`,
            { encoding: 'utf-8', timeout: 5000 },
        );
        const match = output.match(/--remote-debugging-port=(\d+)/);
        if (match) {
            const port = parseInt(match[1], 10);
            logger.info(`found orphan CDP port ${port} from process list`);
            return port;
        }
    } catch {
        // No matching process
    }
    return null;
}

async function getPidForPort(port: number): Promise<number | null> {
    if (process.platform === 'win32') {
        try {
            const output = execSync(`netstat -ano | findstr :${port}`, {
                encoding: 'utf-8',
                timeout: 5000,
            });
            const match = output.match(/LISTENING\s+(\d+)/);
            if (match) return parseInt(match[1], 10);
        } catch {
            // ignore
        }
        return null;
    }
    try {
        const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8', timeout: 5000 });
        const pid = parseInt(output.trim().split('\n')[0], 10);
        return isNaN(pid) ? null : pid;
    } catch {
        return null;
    }
}

async function killOrphanByDataDir(dataDir: string, logger: ILogger): Promise<void> {
    if (process.platform === 'win32') {
        try {
            execSync(
                `wmic process where "CommandLine like '%--user-data-dir=${dataDir.replace(/\\/g, '\\\\')}%'" call terminate`,
                { stdio: 'ignore', timeout: 5000 },
            );
            logger.info(`killed orphan browser via wmic`);
        } catch {
            logger.warn(`failed to kill orphan via wmic`);
        }
    } else {
        try {
            execSync(`pkill -f -- '--user-data-dir=${dataDir}'`, {
                stdio: 'ignore',
                timeout: 5000,
            });
            logger.info(`killed orphan browser via pkill`);
        } catch {
            logger.warn(`failed to kill orphan via pkill (may already be gone)`);
        }
    }
    // Give OS time to release resources
    await new Promise((r) => setTimeout(r, 1000));
}
