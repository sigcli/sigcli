import * as readline from 'node:readline';

import {
    err,
    ManualSetupRequired,
    ok,
    type AuthError,
    type ExtractedCredentials,
    type IStrategy,
    type ProviderConfig,
    type Result,
} from '../../types/index.js';
import type { ExtractionResult } from '../../types/interfaces/strategy.js';

/**
 * PromptStrategy — asks the user for input interactively.
 *
 * extract[].key is used as the prompt message displayed to the user.
 */
export class PromptStrategy implements IStrategy {
    readonly name = 'prompt';
    readonly needsBrowser = false;

    async extract(provider: ProviderConfig): Promise<Result<ExtractionResult, AuthError>> {
        const credentials: ExtractedCredentials = {};

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stderr,
        });

        try {
            for (const rule of provider.extract) {
                const answer = await this.ask(rl, rule.key);
                if (!answer) {
                    return err(new ManualSetupRequired(rule.name, rule.key));
                }
                credentials[rule.name] = answer;
            }
        } finally {
            rl.close();
        }

        return ok({ credentials });
    }

    private ask(rl: readline.Interface, prompt: string): Promise<string> {
        return new Promise((resolve) => {
            rl.question(`${prompt}: `, resolve);
        });
    }
}
