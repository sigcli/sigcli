import type { AuthManager } from '../auth-manager.js';
import { isOk } from '../types/result.js';
import { formatJson, formatCredentialHeaders } from '../utils/formatters.js';
import { ExitCode } from '../utils/exit-codes.js';
import { OutputFormat } from '../types/constants.js';
import { logAuditEvent, AuditAction, AuditStatus } from '../audit/audit-log.js';
import { extractSensitiveValues, redactOutput } from '../utils/redact.js';

export async function runGet(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    auth: AuthManager,
): Promise<void> {
    const target = positionals[0];
    if (!target) {
        process.stderr.write(
            'Usage: sig get <provider|url>\n\n' +
                'Values are redacted by default. Use --no-redaction only when needed.\n' +
                'Prefer "sig request" or "sig run" for automation.\n',
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Unified resolution: try ID → name → URL/domain
    const resolved = auth.providerRegistry.resolveFlexible(target);
    let providerId: string;
    let credential;

    if (resolved) {
        providerId = resolved.id;
        const result = await auth.getCredentials(providerId);
        if (!isOk(result)) {
            await logAuditEvent({
                action: AuditAction.CREDENTIAL_ACCESS,
                status: AuditStatus.FAILURE,
                provider: providerId,
                metadata: { error: result.error.message },
            });
            process.stderr.write(`Error: ${result.error.message}\n`);
            if (result.error.code === 'BROWSER_UNAVAILABLE') {
                process.stderr.write(
                    `Hint: Run "sig login ${target}" or "sig sync pull" to get credentials.\n`,
                );
            }
            process.exitCode =
                result.error.code === 'CREDENTIAL_NOT_FOUND'
                    ? ExitCode.CREDENTIAL_NOT_FOUND
                    : ExitCode.GENERAL_ERROR;
            return;
        }
        credential = result.value;
    } else {
        // Fall through to URL-based resolution (with auto-provisioning) for URL-like inputs
        const isUrl = target.includes('.') || target.startsWith('http');
        if (!isUrl) {
            process.stderr.write(`Error: No provider found matching "${target}".\n`);
            process.exitCode = ExitCode.PROVIDER_NOT_FOUND;
            return;
        }
        const result = await auth.getCredentialsByUrl(target);
        if (!isOk(result)) {
            await logAuditEvent({
                action: AuditAction.CREDENTIAL_ACCESS,
                status: AuditStatus.FAILURE,
                metadata: { target, error: result.error.message },
            });
            process.stderr.write(`Error: ${result.error.message}\n`);
            if (result.error.code === 'BROWSER_UNAVAILABLE') {
                process.stderr.write(
                    `Hint: Run "sig login ${target}" or "sig sync pull" to get credentials.\n`,
                );
            }
            process.exitCode =
                result.error.code === 'PROVIDER_NOT_FOUND'
                    ? ExitCode.PROVIDER_NOT_FOUND
                    : ExitCode.CREDENTIAL_NOT_FOUND;
            return;
        }
        providerId = result.value.provider.id;
        credential = result.value.credential;
    }

    // Apply credential to get headers
    const headers = auth.applyToRequest(providerId, credential);
    const noRedaction = flags['no-redaction'] === true;
    await logAuditEvent({
        action: AuditAction.CREDENTIAL_ACCESS,
        status: AuditStatus.SUCCESS,
        provider: providerId,
        metadata: { credentialType: credential.type, redacted: !noRedaction },
    });
    const entries = Object.entries(headers);

    if (entries.length === 0) {
        process.stderr.write(`Error: No credential headers produced for "${providerId}".\n`);
        process.exitCode = ExitCode.CREDENTIAL_NOT_FOUND;
        return;
    }

    if (noRedaction) {
        process.stderr.write(
            'Warning: Outputting raw credential values — do not expose to untrusted processes.\n',
        );
    }
    const secrets = noRedaction ? [] : extractSensitiveValues(credential);
    const redact = (text: string): string => (noRedaction ? text : redactOutput(text, secrets));

    const format = (flags.format as string) ?? OutputFormat.JSON;
    switch (format) {
        case OutputFormat.JSON: {
            const redactedHeaders: Record<string, string> = {};
            for (const [k, v] of Object.entries(headers)) {
                redactedHeaders[k] = redact(v);
            }
            const output = {
                provider: providerId,
                headers: redactedHeaders,
            };
            process.stdout.write(formatJson(output) + '\n');
            break;
        }
        case OutputFormat.HEADER: {
            const redactedHeaders: Record<string, string> = {};
            for (const [k, v] of Object.entries(headers)) {
                redactedHeaders[k] = redact(v);
            }
            process.stdout.write(formatCredentialHeaders(redactedHeaders) + '\n');
            break;
        }
        case OutputFormat.VALUE: {
            // Output just the first header value (no JSON wrapper)
            const firstValue = entries[0][1];
            process.stdout.write(redact(firstValue) + '\n');
            break;
        }
        default: {
            process.stderr.write(`Unknown format: ${format}\n`);
            process.exitCode = ExitCode.GENERAL_ERROR;
        }
    }
}
