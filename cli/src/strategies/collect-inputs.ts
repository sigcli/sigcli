import * as readline from 'node:readline';

import {
    err,
    ManualSetupRequired,
    ok,
    type AuthError,
    type ExtractedCredentials,
    type ExtractionContext,
    type ProviderConfig,
    type Result,
} from '../types/index.js';

/**
 * Collect values for each extract[] rule.
 * Uses context.setValues when available, falls back to interactive prompting.
 */
export async function collectInputs(
    provider: ProviderConfig,
    context?: ExtractionContext,
): Promise<Result<ExtractedCredentials, AuthError>> {
    const credentials: ExtractedCredentials = {};
    const setValues = context?.setValues;

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
            // rl is guaranteed non-null here: needsPrompt was true
            const answer = await ask(rl as readline.Interface, rule.match);
            if (!answer) {
                return err(new ManualSetupRequired(rule.as, rule.match));
            }
            credentials[rule.as] = answer;
        }
    } finally {
        rl?.close();
    }

    return ok(credentials);
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(`${prompt}: `, resolve);
    });
}
