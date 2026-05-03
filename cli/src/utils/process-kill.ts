import { execSync, type ChildProcess } from 'node:child_process';

/**
 * Kill a child process reliably across platforms.
 * On Windows, uses taskkill /F /T to force-kill the process tree.
 * On Unix, sends SIGTERM with a SIGKILL fallback after timeout.
 */
export function killProcess(child: ChildProcess, timeoutMs = 3000): void {
    if (!child || child.killed || child.pid == null) return;

    if (process.platform === 'win32') {
        try {
            execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
        } catch {
            /* process may already be gone */
        }
    } else {
        child.kill('SIGTERM');
        setTimeout(() => {
            if (!child.killed) {
                try {
                    child.kill('SIGKILL');
                } catch {
                    /* ignore */
                }
            }
        }, timeoutMs).unref();
    }
}

/**
 * Kill a process by PID reliably across platforms.
 * On Windows, uses taskkill. On Unix, sends signal.
 */
export function killPid(pid: number, signal: NodeJS.Signals = 'SIGTERM'): void {
    if (process.platform === 'win32') {
        try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        } catch {
            /* process may already be gone */
        }
    } else {
        process.kill(pid, signal);
    }
}

/**
 * Kill a process and all its children by PID, cross-platform.
 * On Windows, taskkill /T handles the tree natively.
 * On macOS/Linux, kills children first via pkill -P, then the parent.
 */
export function killProcessTree(pid: number): void {
    try {
        process.kill(pid, 0);
    } catch {
        return; // already dead
    }

    if (process.platform === 'win32') {
        try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        } catch {
            /* process may already be gone */
        }
    } else {
        try {
            execSync(`pkill -P ${pid}`, { stdio: 'ignore' });
        } catch {
            /* no children or already gone */
        }
        try {
            process.kill(pid, 'SIGKILL');
        } catch {
            /* already gone */
        }
    }
}
