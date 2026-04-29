import type { AuthManager } from '../auth-manager.js';
import { formatTable } from '../utils/formatters.js';
import { detectFormat, formatOutput } from '../utils/formatter.js';

export async function runProviders(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    auth: AuthManager,
): Promise<void> {
    const format = detectFormat(flags.format as string | undefined, 'table');
    const providers = auth.providerRegistry.list();

    const statuses = await Promise.all(providers.map((p) => auth.getStatus(p.id)));

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
        }));
        process.stdout.write(formatOutput(output, format) + '\n');
    }
}
