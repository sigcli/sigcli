import type { AuthDeps } from '../../deps.js';
import { formatTable } from '../formatters.js';
import { detectFormat, formatOutput } from '../../utils/formatter.js';

export async function runProviders(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: AuthDeps,
): Promise<void> {
    const format = detectFormat(flags.format as string | undefined, 'table');
    const providers = deps.authManager.providerRegistry.list();

    const statuses = await Promise.all(providers.map((p) => deps.authManager.getStatus(p.id)));

    if (format === 'table') {
        if (statuses.length === 0) {
            process.stderr.write('No providers configured.\n');
            return;
        }
        const rows = statuses.map((s) => ({
            id: s.id,
            name: s.name,
            strategy: s.strategy,
            status: s.valid ? 'authenticated' : 'not authenticated',
        }));
        process.stdout.write(formatTable(rows) + '\n');
    } else {
        const output = statuses.map((s) => ({
            id: s.id,
            name: s.name,
            strategy: s.strategy,
            configured: s.configured,
            valid: s.valid,
            credentialType: s.credentialType ?? null,
        }));
        process.stdout.write(formatOutput(output, format) + '\n');
    }
}
