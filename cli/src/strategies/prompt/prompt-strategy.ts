import * as readline from 'node:readline';
import type {
    IStrategy,
    ExtractedCredentials,
    ExtractionContext,
    ExtractionResult,
} from '../../types/interfaces/strategy.js';
import type { ExtractRule } from '../../types/extract.js';
import type { Result } from '../../types/result.js';
import type { AuthError } from '../../types/errors.js';
import { ok, err } from '../../types/result.js';
import { ManualSetupRequired } from '../../types/errors.js';

/**
 * PromptStrategy — asks the user for input interactively.
 *
 * extract[].key is used as the prompt message displayed to the user.
 */
export class PromptStrategy implements IStrategy {
    readonly name = 'prompt';
    readonly needsBrowser = false;

    async extract(
        rules: ExtractRule[],
        _ctx: ExtractionContext,
    ): Promise<Result<ExtractionResult, AuthError>> {
        const credentials: ExtractedCredentials = {};

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stderr,
        });

        try {
            for (const rule of rules) {
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
