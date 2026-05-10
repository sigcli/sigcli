import { AuditAction, AuditStatus, logAuditEvent } from '../audit/audit-log.js';
import type { AuthManager } from '../auth-manager.js';

export async function runLogout(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    auth: AuthManager,
): Promise<void> {
    const providerId = positionals[0];

    if (providerId) {
        const resolved = auth.providerRegistry.resolveFlexible(providerId);
        const resolvedId = resolved?.id ?? providerId;
        await auth.logout(resolvedId);
        await logAuditEvent({
            action: AuditAction.LOGOUT,
            status: AuditStatus.SUCCESS,
            provider: resolvedId,
        });
        process.stderr.write(`Credentials cleared for "${resolvedId}".\n`);
    } else {
        await auth.clearAll();
        await logAuditEvent({
            action: AuditAction.LOGOUT,
            status: AuditStatus.SUCCESS,
            metadata: { scope: 'all' },
        });
        process.stderr.write('All credentials cleared.\n');
    }
}
