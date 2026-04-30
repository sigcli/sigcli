import type { ILogger } from '../types/index.js';

export function createConsoleLogger(): ILogger {
    return {
        debug(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[DEBUG] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        info(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[INFO] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        warn(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[WARN] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        error(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[ERROR] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
    };
}
