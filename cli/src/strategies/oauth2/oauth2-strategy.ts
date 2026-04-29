import type {
    IStrategy,
    ExtractedCredentials,
    ExtractionContext,
} from '../../types/interfaces/strategy.js';
import type { ExtractRule } from '../../types/extract.js';
import type { Result } from '../../types/result.js';
import type { AuthError } from '../../types/errors.js';
import { err } from '../../types/result.js';
import { AuthError as BaseAuthError } from '../../types/errors.js';

/**
 * OAuth2Strategy — stub for future OAuth2 PKCE/device-code flow.
 *
 * Currently returns err("not implemented").
 */
export class OAuth2Strategy implements IStrategy {
    readonly name = 'oauth2';
    readonly needsBrowser = false;

    async extract(
        _rules: ExtractRule[],
        _ctx: ExtractionContext,
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        return err(new BaseAuthError('OAuth2 strategy is not yet implemented', 'CONFIG_ERROR'));
    }
}
