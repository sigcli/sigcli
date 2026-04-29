import type { AuthManager } from '../auth-manager.js';
import { renameProviderInConfig } from '../config/loader.js';
import { ExitCode } from '../utils/exit-codes.js';
import { logAuditEvent, AuditAction, AuditStatus } from '../audit/audit-log.js';

export async function runRename(
    positionals: string[],
    _flags: Record<string, string | boolean | string[]>,
    auth: AuthManager,
): Promise<void> {
    const oldId = positionals[0];
    const newId = positionals[1];

    if (!oldId || !newId) {
        process.stderr.write('Usage: sig rename <old> <new>\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Resolve old provider
    const provider = auth.providerRegistry.resolveFlexible(oldId);
    if (!provider) {
        process.stderr.write(`Error: No provider found matching "${oldId}".\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Check new ID doesn't collide
    const existing = auth.providerRegistry.get(newId);
    if (existing) {
        process.stderr.write(`Error: Provider "${newId}" already exists.\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const resolvedOldId = provider.id;
    // Move credential in storage
    const stored = await auth.storage.get(resolvedOldId);
    if (stored) {
        stored.providerId = newId;
        await auth.storage.set(newId, stored);
        await auth.storage.delete(resolvedOldId);
    }

    // Update in-memory registry (shallow copy to avoid mutating the original)
    auth.providerRegistry.unregister(resolvedOldId);
    const updated = {
        ...provider,
        id: newId,
        name: provider.name === resolvedOldId ? newId : provider.name,
    };
    auth.providerRegistry.register(updated);

    // Update config.yaml
    await renameProviderInConfig(resolvedOldId, newId);

    await logAuditEvent({
        action: AuditAction.PROVIDER_RENAME,
        status: AuditStatus.SUCCESS,
        provider: newId,
        metadata: { oldId: resolvedOldId },
    });
    process.stderr.write(`Renamed "${resolvedOldId}" → "${newId}".\n`);
}
