import type { ISourceStrategy, ExtractedCredentials, ExtractionContext } from '../../core/interfaces/source-strategy.js';
import type { ExtractRule } from '../../core/types/extract.js';
import type { Result } from '../../core/result.js';
import type { AuthError } from '../../core/errors.js';
import { err } from '../../core/result.js';
import { AuthError as BaseAuthError } from '../../core/errors.js';

/**
 * OAuth2Strategy — stub for future OAuth2 PKCE/device-code flow.
 *
 * Currently returns err("not implemented").
 */
export class OAuth2Strategy implements ISourceStrategy {
    readonly name = 'oauth2';
    readonly needsBrowser = false;

    async extract(
        _rules: ExtractRule[],
        _ctx: ExtractionContext,
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        return err(new BaseAuthError('OAuth2 strategy is not yet implemented', 'CONFIG_ERROR'));
    }
}
