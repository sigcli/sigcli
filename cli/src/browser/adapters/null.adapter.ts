import { BrowserUnavailableError } from '../../core/errors.js';
import type { IBrowserAdapter, IBrowserSession } from '../../core/interfaces/browser-adapter.js';
import type { BrowserLaunchOptions } from '../../core/types.js';

/**
 * Null browser adapter — used when no browser is available on the machine.
 * Every call to launch() throws BrowserUnavailableError with a descriptive reason.
 */
export class NullBrowserAdapter implements IBrowserAdapter {
    readonly name = 'null';

    constructor(private readonly reason: string) {}

    async launch(_options: BrowserLaunchOptions): Promise<IBrowserSession> {
        throw new BrowserUnavailableError(this.reason);
    }
}
