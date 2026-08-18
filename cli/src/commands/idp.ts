/**
 * `sig idp` — manage per-hostname Identity Provider secrets (currently TOTP).
 *
 * Metadata (hostname, label, totp.autoSubmit) lives in ~/.sig/config.yaml.
 * The TOTP secret lives encrypted at ~/.sig/idps/<hostname>.json.
 * Secrets are NEVER printed by list/show — only their presence is reported.
 */

import os from 'node:os';
import path from 'node:path';

import { IdpSubcommand } from '../types/index.js';
import { loadEncryptionKey } from '../crypto/encryption.js';
import { ExitCode } from '../utils/exit-codes.js';
import { formatJson, formatTable } from '../utils/formatters.js';
import { promptSecret } from '../utils/prompt.js';
import { computeTotp } from '../utils/totp.js';
import { getIdpMetaEntries, removeIdpMetaEntry, setIdpMetaEntry } from '../idps/idp-config.js';
import { IdpStore } from '../idps/idp-store.js';
import type { IdpMetaEntry } from '../idps/types.js';

const USAGE = `Usage: sig idp <subcommand> [options]

Subcommands:
  add <hostname>                   Add or replace an IdP entry
    --totp-secret <secret>           Base32 TOTP secret (prompted if omitted)
    --auto-submit                    Auto-submit the OTP form after filling (default)
    --no-auto-submit                 Fill only — do not submit
    --label <name>                   Optional friendly name
  list [--format json|table]       List configured IdPs (secrets redacted)
  show <hostname>                  Show a single IdP entry (secret redacted)
  remove <hostname>                Remove an IdP entry (metadata + secret)
`;

function idpDir(): string {
    return path.join(os.homedir(), '.sig', 'idps');
}

async function asyncIdpStore(): Promise<IdpStore> {
    const key = await loadEncryptionKey();
    return new IdpStore(idpDir(), key);
}

function totpStatus(meta: IdpMetaEntry, hasSecret: boolean): string {
    if (!hasSecret) return 'none';
    const autoSubmit = meta.totp?.autoSubmit ?? true;
    return autoSubmit ? 'configured (auto-submit)' : 'configured (fill-only)';
}

export async function runIdp(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<void> {
    const subcommand = positionals[0];

    switch (subcommand) {
        case IdpSubcommand.ADD:
            return runAdd(positionals, flags);
        case IdpSubcommand.LIST:
            return runList(flags);
        case IdpSubcommand.SHOW:
            return runShow(positionals);
        case IdpSubcommand.REMOVE:
            return runRemove(positionals);
        default:
            process.stderr.write(USAGE);
            process.exitCode = ExitCode.GENERAL_ERROR;
    }
}

async function runAdd(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<void> {
    const hostname = positionals[1];
    if (!hostname) {
        process.stderr.write('Usage: sig idp add <hostname> [--totp-secret <secret>] ...\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    let secret: string | undefined;
    if (typeof flags['totp-secret'] === 'string') {
        secret = flags['totp-secret'];
    } else {
        secret = (await promptSecret('TOTP secret (base32): ')).trim();
    }
    if (!secret) {
        process.stderr.write('Error: TOTP secret is required\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }
    // Normalize: strip spaces (authenticator apps often show them in groups).
    secret = secret.replace(/\s+/g, '');

    try {
        computeTotp(secret);
    } catch (e) {
        process.stderr.write(`Error: invalid TOTP secret — ${(e as Error).message}\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const label = typeof flags.label === 'string' ? flags.label : undefined;
    // --auto-submit defaults to true; --no-auto-submit disables. Parser exposes
    // negation flags as flags['no-auto-submit'] = true.
    let autoSubmit = true;
    if (flags['no-auto-submit'] === true) autoSubmit = false;
    else if (flags['auto-submit'] === false) autoSubmit = false;

    const meta: IdpMetaEntry = {
        ...(label ? { label } : {}),
        totp: { autoSubmit },
    };

    await setIdpMetaEntry(hostname, meta);
    const store = await asyncIdpStore();
    await store.setSecret(hostname, secret);

    process.stderr.write(`IdP "${hostname}" added (totp configured, auto-submit=${autoSubmit})\n`);
}

async function runList(flags: Record<string, string | boolean | string[]>): Promise<void> {
    const meta = await getIdpMetaEntries();
    const store = await asyncIdpStore();

    const rows = await Promise.all(
        Object.entries(meta).map(async ([hostname, m]) => {
            const hasSecret = (await store.getSecret(hostname).catch(() => null)) !== null;
            return {
                hostname,
                label: m.label ?? '',
                totp: totpStatus(m, hasSecret),
            };
        }),
    );

    if (rows.length === 0) {
        process.stderr.write(
            'No IdPs configured. Use "sig idp add <hostname> --totp-secret <secret>" to add one.\n',
        );
        return;
    }

    const format = typeof flags.format === 'string' ? flags.format : 'table';
    if (format === 'json') {
        process.stdout.write(formatJson(rows) + '\n');
    } else {
        process.stdout.write(formatTable(rows) + '\n');
    }
}

async function runShow(positionals: string[]): Promise<void> {
    const hostname = positionals[1];
    if (!hostname) {
        process.stderr.write('Usage: sig idp show <hostname>\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const meta = await getIdpMetaEntries();
    const entry = meta[hostname];
    if (!entry) {
        process.stderr.write(`IdP "${hostname}" not found\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const store = await asyncIdpStore();
    const hasSecret = (await store.getSecret(hostname).catch(() => null)) !== null;

    process.stdout.write(
        formatJson({
            hostname,
            label: entry.label ?? null,
            totp: hasSecret
                ? {
                      configured: true,
                      autoSubmit: entry.totp?.autoSubmit ?? true,
                      secret: '<redacted>',
                  }
                : { configured: false },
        }) + '\n',
    );
}

async function runRemove(positionals: string[]): Promise<void> {
    const hostname = positionals[1];
    if (!hostname) {
        process.stderr.write('Usage: sig idp remove <hostname>\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }
    const removed = await removeIdpMetaEntry(hostname);
    const store = await asyncIdpStore();
    await store.deleteSecret(hostname);
    if (removed) {
        process.stderr.write(`IdP "${hostname}" removed\n`);
    } else {
        process.stderr.write(`IdP "${hostname}" not found in config\n`);
    }
}
