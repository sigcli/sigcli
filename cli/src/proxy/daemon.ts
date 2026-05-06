import { parseDuration } from '../utils/duration.js';
import { createOperationalLogger } from '../utils/logger.js';
import { expandHome } from '../utils/path.js';
import type { AuthManager } from '../auth-manager.js';
import { getWatchConfig, getWatchProviders } from '../watch/watch-config.js';
import { startWatchLoop } from '../watch/watch-loop.js';
import { CaManager } from './ca-manager.js';
import { ProxyServer } from './proxy-server.js';
import { clearState, writeState } from './proxy-state.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export interface DaemonOptions {
    port: number;
    auth: AuthManager;
}

export async function startDaemon(opts: DaemonOptions, signal: AbortSignal): Promise<void> {
    const logger = createOperationalLogger();
    const proxyDir = expandHome('~/.sig/proxy');
    const caManager = new CaManager(proxyDir, logger);
    const server = new ProxyServer({ port: opts.port, auth: opts.auth, caManager, logger });

    const { port } = await server.start();
    await writeState({ pid: process.pid, port });

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
                authManager: opts.auth,
                storage: opts.auth.storage,
                config: opts.auth.config,
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
