/**
 * `sig idp` — manage per-hostname Identity Provider secrets (currently TOTP).
 *
 * Metadata (hostname, label, totp presence) lives in ~/.sig/config.yaml.
 * The TOTP secret lives encrypted at ~/.sig/idps/<hostname>.json.
 * Secrets are NEVER printed by list/show — only their presence is reported.
 *
 * Custom OTP form selectors (totp.selectors.input / totp.selectors.submit) are
 * NOT exposed via CLI flags — edit ~/.sig/config.yaml directly to configure
 * them. `sig idp add` preserves any hand-configured selectors on an existing
 * entry when rotating the secret.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { IdpSubcommand } from '../types/index.js';
import { loadEncryptionKey } from '../crypto/encryption.js';
import { ExitCode } from '../utils/exit-codes.js';
import { formatJson, formatTable } from '../utils/formatters.js';
import { promptSecret } from '../utils/prompt.js';
import { computeTotp, isValidBase32 } from '../utils/totp.js';
import { getIdpMetaEntries, removeIdpMetaEntry, setIdpMetaEntry } from '../idps/idp-config.js';
import { IdpStore } from '../idps/idp-store.js';
import type { IdpMetaEntry } from '../idps/types.js';

const USAGE = `Usage: sig idp <subcommand> [options]

Subcommands:
  add <hostname>                   Add or replace an IdP entry
    --totp-secret <secret>           Base32 TOTP secret (prompted if omitted)
    --label <name>                   Optional friendly name
  list [--format json|table]       List configured IdPs (secrets redacted)
  show <hostname>                  Show a single IdP entry (secret redacted)
  remove <hostname>                Remove an IdP entry (metadata + secret)

Custom OTP form selectors are configured by hand-editing ~/.sig/config.yaml
under idps.<hostname>.totp.selectors.{input,submit}.
`;

function configPath(): string {
    return path.join(os.homedir(), '.sig', 'config.yaml');
}

function requireConfig(): boolean {
    const p = configPath();
    if (fs.existsSync(p)) return true;
    process.stderr.write(`Config not found at ${p}. Run \`sig init\` first.\n`);
    process.exitCode = ExitCode.GENERAL_ERROR;
    return false;
}

function idpDir(): string {
    return path.join(os.homedir(), '.sig', 'idps');
}

async function asyncIdpStore(): Promise<IdpStore> {
    const key = await loadEncryptionKey();
    return new IdpStore(idpDir(), key);
}

function totpStatus(_meta: IdpMetaEntry, hasSecret: boolean): string {
    return hasSecret ? 'configured' : 'none';
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

    if (!requireConfig()) return;

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

    if (!isValidBase32(secret)) {
        process.stderr.write(
            'Error: invalid TOTP secret. Must be base32 (A-Z, 2-7) and at least 16 characters.\n',
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Sanity check that otpauth also accepts it (defensive — isValidBase32
    // already covers the alphabet, so this should never trip in practice).
    try {
        computeTotp(secret);
    } catch (e) {
        process.stderr.write(`Error: invalid TOTP secret — ${(e as Error).message}\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Preserve unrelated fields from an existing entry — label (if not
    // re-supplied) and any hand-configured totp.selectors.
    const existing = (await getIdpMetaEntries())[hostname];
    const label = typeof flags.label === 'string' ? flags.label : existing?.label;
    const selectors = existing?.totp?.selectors;

    const meta: IdpMetaEntry = {
        ...(label !== undefined ? { label } : {}),
        totp: {
            ...(selectors ? { selectors } : {}),
        },
    };

    await setIdpMetaEntry(hostname, meta);
    const store = await asyncIdpStore();
    await store.setSecret(hostname, secret);

    process.stderr.write(`IdP "${hostname}" added (totp configured)\n`);
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
    if (!requireConfig()) return;
    const removed = await removeIdpMetaEntry(hostname);
    const store = await asyncIdpStore();
    await store.deleteSecret(hostname);
    if (removed) {
        process.stderr.write(`IdP "${hostname}" removed\n`);
    } else {
        process.stderr.write(`IdP "${hostname}" not found in config\n`);
    }
}
