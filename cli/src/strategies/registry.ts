import type { IAuthStrategy, IAuthStrategyFactory } from '../core/interfaces/auth-strategy.js';
import type { StrategyConfig } from '../config/schema.js';
import { ConfigError } from '../core/errors.js';

/**
 * Registry that maps strategy names to their factories.
 * Built-in strategies are registered at startup; users can add custom ones.
 */
export class StrategyRegistry {
    private factories = new Map<string, IAuthStrategyFactory>();

    register(factory: IAuthStrategyFactory): void {
        this.factories.set(factory.name, factory);
    }

    get(name: string, config: StrategyConfig): IAuthStrategy {
        const factory = this.factories.get(name);
        if (!factory) {
            const available = Array.from(this.factories.keys()).join(', ');
            throw new ConfigError(
                `Unknown strategy "${name}". Available strategies: ${available || 'none'}`,
            );
        }
        return factory.create(config);
    }

    has(name: string): boolean {
        return this.factories.has(name);
    }

    list(): string[] {
        return Array.from(this.factories.keys());
    }
}
