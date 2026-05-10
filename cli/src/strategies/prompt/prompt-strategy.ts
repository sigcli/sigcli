import {
    ok,
    type AuthError,
    type ExtractionContext,
    type IStrategy,
    type ProviderConfig,
    type Result,
} from '../../types/index.js';
import type { ExtractionResult } from '../../types/interfaces/strategy.js';
import { collectInputs } from '../collect-inputs.js';

/**
 * PromptStrategy — asks the user for input interactively.
 *
 * extract[].match is used as the prompt message displayed to the user.
 * If context.setValues provides a value for rule.match, that value is used directly.
 */
export class PromptStrategy implements IStrategy {
    readonly name = 'prompt';
    readonly needsBrowser = false;

    async extract(
        provider: ProviderConfig,
        context?: ExtractionContext,
    ): Promise<Result<ExtractionResult, AuthError>> {
        const result = await collectInputs(provider, context);
        if (!result.ok) return result;
        return ok({ credentials: result.value });
    }
}
