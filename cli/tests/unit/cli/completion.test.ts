import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runCompletion } from '../../../src/cli/commands/completion.js';

describe('runCompletion', () => {
    let stdoutData: string;
    let stderrData: string;
    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    const origExitCode = process.exitCode;

    beforeEach(() => {
        stdoutData = '';
        stderrData = '';
        process.stdout.write = (chunk: string | Uint8Array) => {
            stdoutData += chunk.toString();
            return true;
        };
        process.stderr.write = (chunk: string | Uint8Array) => {
            stderrData += chunk.toString();
            return true;
        };
        process.exitCode = undefined;
    });

    afterEach(() => {
        process.stdout.write = origStdoutWrite;
        process.stderr.write = origStderrWrite;
        process.exitCode = origExitCode;
    });

    it('outputs bash completion script containing _sig_completions', async () => {
        await runCompletion(['bash'], {});
        expect(stdoutData).toContain('_sig_completions');
        expect(stdoutData).toContain('complete -F _sig_completions sig');
        expect(process.exitCode).toBeUndefined();
    });

    it('outputs zsh completion script containing compdef', async () => {
        await runCompletion(['zsh'], {});
        expect(stdoutData).toContain('compdef');
        expect(stdoutData).toContain('_describe');
        expect(process.exitCode).toBeUndefined();
    });

    it('outputs fish completion script containing complete -c sig', async () => {
        await runCompletion(['fish'], {});
        expect(stdoutData).toContain('complete -c sig');
        expect(process.exitCode).toBeUndefined();
    });

    it('auto-detects shell from $SHELL when no arg given', async () => {
        const origShell = process.env.SHELL;
        process.env.SHELL = '/bin/zsh';
        await runCompletion([], {});
        expect(stdoutData).toContain('compdef');
        expect(process.exitCode).toBeUndefined();
        process.env.SHELL = origShell;
    });

    it('writes error when no shell specified and $SHELL is unset', async () => {
        const origShell = process.env.SHELL;
        delete process.env.SHELL;
        await runCompletion([], {});
        expect(stderrData).toContain('Usage');
        expect(process.exitCode).toBe(1);
        process.env.SHELL = origShell;
    });

    it('writes error to stderr for unknown shell', async () => {
        await runCompletion(['powershell'], {});
        expect(stderrData).toContain('Unknown shell');
        expect(process.exitCode).toBe(1);
    });
});
