import * as readline from 'node:readline';

import {
    err,
    ManualSetupRequired,
    ok,
    type AuthError,
    type ExtractedCredentials,
    type ExtractionContext,
    type IStrategy,
    type ProviderConfig,
    type Result,
} from '../../types/index.js';
import type { ExtractionResult } from '../../types/interfaces/strategy.js';

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
        const credentials: ExtractedCredentials = {};
        const setValues = context?.setValues;

        // If all values are pre-filled, skip interactive prompting entirely
        const needsPrompt = provider.extract.some((rule) => setValues?.[rule.match] === undefined);

        const rl = needsPrompt
            ? readline.createInterface({ input: process.stdin, output: process.stderr })
            : null;

        try {
            for (const rule of provider.extract) {
                const preSet = setValues?.[rule.match];
                if (preSet !== undefined) {
                    credentials[rule.as] = preSet;
                    continue;
                }
                const answer = await this.ask(rl!, rule.match);
                if (!answer) {
                    return err(new ManualSetupRequired(rule.as, rule.match));
                }
                credentials[rule.as] = answer;
            }
        } finally {
            rl?.close();
        }

        return ok({ credentials });
    }

    private ask(rl: readline.Interface, prompt: string): Promise<string> {
        return new Promise((resolve) => {
            rl.question(`${prompt}: `, resolve);
        });
    }
}
