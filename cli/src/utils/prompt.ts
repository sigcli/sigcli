import { createInterface } from 'node:readline/promises';

/**
 * Prompt the user for a single line of input.
 * Writes the label to stderr; reads from stdin.
 */
export async function promptLine(label: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
        return await rl.question(label);
    } finally {
        rl.close();
    }
}

/**
 * Prompt the user for a secret (masked — no echo).
 * Writes the label to stderr; reads raw keystrokes from stdin.
 */
export async function promptSecret(label: string): Promise<string> {
    process.stderr.write(label);
    process.stdin.setRawMode?.(true);
    return new Promise<string>((resolve) => {
        let input = '';
        const onData = (chunk: Buffer) => {
            const char = chunk.toString('utf8');
            if (char === '\r' || char === '\n') {
                process.stdin.removeListener('data', onData);
                process.stdin.setRawMode?.(false);
                process.stderr.write('\n');
                resolve(input);
            } else if (char === '\u0003') {
                process.stdin.removeListener('data', onData);
                process.stdin.setRawMode?.(false);
                process.stderr.write('\n');
                resolve('');
            } else if (char === '\u007f' || char === '\b') {
                input = input.slice(0, -1);
            } else {
                input += char;
            }
        };
        process.stdin.on('data', onData);
        process.stdin.resume();
    });
}
