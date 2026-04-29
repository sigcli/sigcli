import type { ISourceStrategy } from '../core/interfaces/source-strategy.js';

/**
 * StrategyRegistry — manages source strategy instances by name.
 *
 * Used by AuthManager to look up which strategy handles a given provider.source.
 */
export class StrategyRegistry {
    private strategies = new Map<string, ISourceStrategy>();

    register(strategy: ISourceStrategy): void {
        this.strategies.set(strategy.name, strategy);
    }

    get(name: string): ISourceStrategy | undefined {
        return this.strategies.get(name);
    }

    list(): ISourceStrategy[] {
        return [...this.strategies.values()];
    }

    has(name: string): boolean {
        return this.strategies.has(name);
    }
}
