import { fork } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { readState, isRunning, clearState } from '../../proxy/proxy-state.js';
import { expandHome } from '../../utils/path.js';
import { ExitCode } from '../exit-codes.js';
import type { AuthDeps } from '../../deps.js';
import { ProxySubcommand } from '../../core/constants.js';
import { logAuditEvent, AuditAction, AuditStatus } from '../../audit/audit-log.js';

const USAGE = `Usage: sig proxy <subcommand>

Subcommands:
  start [--port 8080]    Start proxy daemon in background
  stop                   Stop proxy daemon
  status                 Show proxy daemon status
  trust                  Print CA certificate path (add to system trust)
`;

export async function runProxy(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    deps?: AuthDeps,
): Promise<void> {
    const subcommand = positionals[0];

    switch (subcommand) {
        case ProxySubcommand.START:
            await handleStart(flags, deps);
            break;
        case ProxySubcommand.STOP:
            await handleStop();
            break;
        case ProxySubcommand.STATUS:
            await handleStatus();
            break;
        case ProxySubcommand.TRUST:
            handleTrust();
            break;
        default:
            process.stderr.write(USAGE);
            process.exitCode = subcommand ? ExitCode.GENERAL_ERROR : ExitCode.SUCCESS;
    }
}

async function handleStart(
    flags: Record<string, string | boolean | string[]>,
    deps?: AuthDeps,
): Promise<void> {
    if (!deps) {
        process.stderr.write('Error: Config required. Run "sig init" first.\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    if (await isRunning()) {
        const state = await readState();
        if (state) {
            process.stderr.write(
                `Proxy is already running (pid=${state.pid}, port=${state.port})\n`,
            );
        }
        return;
    }

    const portFlag = flags.port;
    const port = typeof portFlag === 'string' ? parseInt(portFlag, 10) : 0;

    // If PROXY_DAEMON=1 env var is set, run in-process (we are the daemon child)
    if (process.env.PROXY_DAEMON === '1') {
        const { startDaemon } = await import('../../proxy/daemon.js');
        const controller = new AbortController();
        const shutdown = () => controller.abort();
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        await startDaemon({ port, authDeps: deps }, controller.signal);
        return;
    }

    // Fork a detached background child
    const entry = join(dirname(fileURLToPath(import.meta.url)), '../../../bin/sig.js');

    const proxyDir = expandHome('~/.sig/proxy');
    await mkdir(proxyDir, { recursive: true });
    const logPath = join(proxyDir, 'proxy.log');
    const logFd = openSync(logPath, 'a');

    const child = fork(entry, ['proxy', 'start', ...(port ? ['--port', String(port)] : [])], {
        detached: true,
        stdio: ['ignore', logFd, logFd, 'ipc'],
        env: { ...process.env, PROXY_DAEMON: '1' },
    });

    // Wait briefly for daemon to write state files or exit with error
    const started = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(true), 2000);
        child.on('exit', (code) => {
            clearTimeout(timeout);
            if (code !== 0) resolve(false);
            else resolve(true);
        });
    });

    child.unref();
    child.disconnect();
    closeSync(logFd);

    if (!started) {
        process.stderr.write(`Proxy daemon failed to start. Check ${logPath} for details.\n`);
        await logAuditEvent({
            action: AuditAction.PROXY_START,
            status: AuditStatus.FAILURE,
            metadata: { port: port || 'auto', logPath },
        });
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    await logAuditEvent({
        action: AuditAction.PROXY_START,
        status: AuditStatus.SUCCESS,
        metadata: { port: port || 'auto' },
    });
    process.stderr.write('Proxy daemon started in background.\n');
    process.stderr.write('Run "sig proxy status" to check, "sig proxy stop" to stop.\n');
}

async function handleStop(): Promise<void> {
    const state = await readState();
    if (!state) {
        process.stderr.write('Proxy is not running.\n');
        return;
    }

    if (!(await isRunning())) {
        await clearState();
        process.stderr.write('Proxy was not running (stale state cleared).\n');
        return;
    }

    try {
        process.kill(state.pid, 'SIGTERM');
        await logAuditEvent({
            action: AuditAction.PROXY_STOP,
            status: AuditStatus.SUCCESS,
            metadata: { pid: state.pid },
        });
        process.stderr.write(`Proxy stopped (pid=${state.pid}).\n`);
    } catch {
        await logAuditEvent({
            action: AuditAction.PROXY_STOP,
            status: AuditStatus.FAILURE,
            metadata: { pid: state.pid },
        });
        process.stderr.write(`Failed to stop proxy (pid=${state.pid}).\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
    }
}

async function handleStatus(): Promise<void> {
    const state = await readState();
    if (!state) {
        process.stdout.write('Proxy: not running\n');
    } else {
        const running = await isRunning();
        if (running) {
            process.stdout.write(`Proxy: running  pid=${state.pid}  port=${state.port}\n`);
            process.stdout.write(`  http_proxy=http://127.0.0.1:${state.port}\n`);
            process.stdout.write(`  https_proxy=http://127.0.0.1:${state.port}\n`);
        } else {
            await clearState();
            process.stdout.write('Proxy: not running (stale state cleared)\n');
        }
    }

    // Watch status
    const { getWatchConfig } = await import('../../watch/watch-config.js');
    const watchConfig = await getWatchConfig();
    const watchProviders = watchConfig ? Object.keys(watchConfig.providers) : [];

    process.stdout.write('\n');
    if (watchProviders.length > 0) {
        process.stdout.write(
            `Watch: ${watchProviders.length} provider(s)  interval=${watchConfig!.interval}\n`,
        );
        for (const id of watchProviders) {
            const opts = watchConfig!.providers[id];
            const sync = opts.autoSync.length > 0 ? ` → sync: ${opts.autoSync.join(', ')}` : '';
            process.stdout.write(`  ${id}${sync}\n`);
        }
    } else {
        process.stdout.write('Watch: no providers configured\n');
    }

    // Sync/remote status
    const { getRemotes } = await import('../../sync/remote-config.js');
    const remotes = await getRemotes();

    process.stdout.write('\n');
    if (remotes.length > 0) {
        process.stdout.write(`Remotes: ${remotes.length} configured\n`);
        for (const r of remotes) {
            const target = r.host ? `${r.user ? r.user + '@' : ''}${r.host}` : r.name;
            process.stdout.write(`  ${r.name} (${r.type}) → ${target}\n`);
        }
    } else {
        process.stdout.write('Remotes: none configured\n');
    }
}

function handleTrust(): void {
    const caPath = expandHome('~/.sig/proxy/ca.crt');
    process.stdout.write(`CA certificate: ${caPath}\n\n`);
    process.stdout.write('To trust the proxy CA:\n');
    process.stdout.write(
        '  macOS:   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ' +
            caPath +
            '\n',
    );
    process.stdout.write(
        '  Ubuntu:  sudo cp ' +
            caPath +
            ' /usr/local/share/ca-certificates/sigcli-proxy.crt && sudo update-ca-certificates\n',
    );
    process.stdout.write('  curl:    curl --cacert ' + caPath + ' ...\n');
}
