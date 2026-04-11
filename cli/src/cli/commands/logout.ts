import type { AuthDeps } from '../../deps.js';

export async function runLogout(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: AuthDeps,
): Promise<void> {
    const providerId = positionals[0];

    if (providerId) {
        const resolved = deps.authManager.providerRegistry.resolveFlexible(providerId);
        const resolvedId = resolved?.id ?? providerId;
        await deps.authManager.clearCredentials(resolvedId);
        process.stderr.write(`Credentials cleared for "${resolvedId}".\n`);
    } else {
        await deps.authManager.clearAll();
        process.stderr.write('All credentials cleared.\n');
    }
}
