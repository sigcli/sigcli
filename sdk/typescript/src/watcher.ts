import fs from 'node:fs';
import { EventEmitter } from 'node:events';

const DEBOUNCE_MS = 100;

export class CredentialWatcher extends EventEmitter {
    private abortController: AbortController | null = null;
    private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(private readonly credentialsDir: string) {
        super();
    }

    start(): void {
        if (this.abortController) return;
        this.abortController = new AbortController();

        try {
            const watcher = fs.watch(this.credentialsDir, {
                signal: this.abortController.signal,
            });

            watcher.on('change', (_eventType, filename) => {
                if (!filename || typeof filename !== 'string') return;
                if (!filename.endsWith('.json') || filename.endsWith('.lock')) return;
                const providerId = filename.replace(/\.json$/, '');
                this.debounce(providerId);
            });

            watcher.on('error', (err) => {
                if ((err as Error & { code?: string }).code !== 'ABORT_ERR') {
                    this.emit('error', err);
                }
            });
        } catch (err) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)));
        }
    }

    stop(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }

    private debounce(providerId: string): void {
        const existing = this.debounceTimers.get(providerId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
            this.debounceTimers.delete(providerId);
            this.emit('change', providerId);
        }, DEBOUNCE_MS);
        this.debounceTimers.set(providerId, timer);
    }
}
