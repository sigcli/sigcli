import { execFile } from 'node:child_process';
import { platform } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Restrict a file to current-user-only access on Windows via icacls.
 * Removes inherited ACLs and grants only the current user.
 * No-op on non-Windows platforms. Best-effort — failures are silently ignored.
 *
 * @param permission - Windows ACL permission: '(R)' for read-only (keys), '(F)' for full control (mutable credentials)
 */
export async function restrictFileWindows(
    filePath: string,
    permission: '(R)' | '(F)' = '(F)',
): Promise<void> {
    if (platform() !== 'win32') return;
    const user = process.env.USERNAME ?? process.env.USER;
    if (!user) return;
    try {
        await execFileAsync('icacls', [
            filePath,
            '/inheritance:r',
            '/grant:r',
            `${user}:${permission}`,
        ]);
    } catch {
        // best-effort: icacls may fail on network drives or non-NTFS
    }
}
