import type { IStrategy } from '../types/index.js';

/**
 * StrategyRegistry — manages source strategy instances by name.
 *
 * Used by AuthManager to look up which strategy handles a given provider.strategy.
 */
export class StrategyRegistry {
    private strategies = new Map<string, IStrategy>();

    register(strategy: IStrategy): void {
        this.strategies.set(strategy.name, strategy);
    }

    get(name: string): IStrategy | undefined {
        return this.strategies.get(name);
    }

    list(): IStrategy[] {
        return [...this.strategies.values()];
    }

    has(name: string): boolean {
        return this.strategies.has(name);
    }
}
