import { startWatchLoop } from '../watch/watch-loop.js';
import { getWatchConfig, getWatchProviders } from '../watch/watch-config.js';
import { parseDuration } from '../utils/duration.js';
import { ProxyServer } from './proxy-server.js';
import { CaManager } from './ca-manager.js';
import { writeState, clearState } from './proxy-state.js';
import { expandHome } from '../utils/path.js';
import type { AuthDeps } from '../deps.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export interface DaemonOptions {
    port: number;
    authDeps: AuthDeps;
}

export async function startDaemon(opts: DaemonOptions, signal: AbortSignal): Promise<void> {
    const proxyDir = expandHome('~/.sig/proxy');
    const caManager = new CaManager(proxyDir);
    const server = new ProxyServer({ port: opts.port, authDeps: opts.authDeps, caManager });

    const { port } = await server.start();
    await writeState({ pid: process.pid, port });

    const logger = {
        debug: (msg: string) => process.stderr.write(`[proxy] ${msg}\n`),
        info: (msg: string) => process.stderr.write(`[proxy] ${msg}\n`),
        warn: (msg: string) => process.stderr.write(`[proxy] WARN: ${msg}\n`),
        error: (msg: string) => process.stderr.write(`[proxy] ERROR: ${msg}\n`),
    };

    process.stderr.write(`[proxy] Listening on 127.0.0.1:${port}\n`);

    // Graceful shutdown
    const cleanup = async () => {
        await server.stop();
        await clearState();
    };

    signal.addEventListener(
        'abort',
        () => {
            cleanup().catch(() => undefined);
        },
        { once: true },
    );

    // Watch loop — optional, runs if watch config exists
    const watchConfig = await getWatchConfig();
    if (watchConfig && Object.keys(watchConfig.providers).length > 0) {
        let intervalMs = DEFAULT_INTERVAL_MS;
        try {
            intervalMs = parseDuration(watchConfig.interval);
        } catch {
            // use default
        }

        await startWatchLoop(
            {
                authManager: opts.authDeps.authManager,
                storage: opts.authDeps.storage,
                config: opts.authDeps.config,
                logger,
            },
            { intervalMs, once: false },
            getWatchProviders,
            signal,
            () => undefined,
        );
    } else {
        // No watch config — wait for abort
        await new Promise<void>((resolve) => {
            signal.addEventListener('abort', () => resolve(), { once: true });
        });
    }
}
