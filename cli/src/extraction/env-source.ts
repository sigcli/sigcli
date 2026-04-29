import type { ISourceStrategy, ExtractedCredentials, ExtractionContext } from '../core/interfaces/source-strategy.js';
import type { ExtractRule } from '../core/types/extract.js';
import type { Result } from '../core/result.js';
import type { AuthError } from '../core/errors.js';
import { ok, err } from '../core/result.js';
import { CredentialNotFoundError } from '../core/errors.js';

/**
 * EnvSource — reads credentials from environment variables.
 *
 * extract[].key is the environment variable name to read.
 */
export class EnvSource implements ISourceStrategy {
    readonly name = 'env';
    readonly needsBrowser = false;

    async extract(
        rules: ExtractRule[],
        _ctx: ExtractionContext,
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        const credentials: ExtractedCredentials = {};

        for (const rule of rules) {
            const value = process.env[rule.key];
            if (!value) {
                return err(new CredentialNotFoundError(rule.name));
            }
            credentials[rule.name] = value;
        }

        return ok(credentials);
    }
}
