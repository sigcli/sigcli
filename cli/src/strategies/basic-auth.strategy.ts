import type { IAuthStrategy, IAuthStrategyFactory } from '../core/interfaces/auth-strategy.js';
import type { Credential, CredentialResult, ProviderConfig } from '../core/types.js';
import type { StrategyConfig, BasicStrategyConfig } from '../config/schema.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { ManualSetupRequired, type AuthError } from '../core/errors.js';
import { HttpHeader, AuthScheme, StrategyName, CredentialTypeName } from '../core/constants.js';

/**
 * Basic authentication strategy.
 * User provides username + password — no browser automation needed.
 * Produces an Authorization: Basic <base64> header.
 */
class BasicAuthStrategy implements IAuthStrategy {
  private readonly setupInstructions?: string;

  constructor(config: BasicStrategyConfig) {
    this.setupInstructions = config.setupInstructions;
  }

  validate(credential: Credential): Result<boolean, AuthError> {
    if (credential.type !== CredentialTypeName.BASIC) return ok(false);
    return ok(
      credential.username.length > 0 && credential.password.length > 0,
    );
  }

  async authenticate(
    provider: ProviderConfig,
  ): Promise<Result<CredentialResult, AuthError>> {
    return err(
      new ManualSetupRequired(
        provider.id,
        this.setupInstructions ??
          provider.setupInstructions ??
          'Please provide username and password for basic authentication.',
      ),
    );
  }

  async refresh(): Promise<Result<Credential | null, AuthError>> {
    return ok(null);
  }

  applyToRequest(credential: Credential): Record<string, string> {
    if (credential.type !== CredentialTypeName.BASIC) return {};

    const encoded = Buffer.from(
      `${credential.username}:${credential.password}`,
    ).toString('base64');

    return { [HttpHeader.AUTHORIZATION]: `${AuthScheme.BASIC} ${encoded}` };
  }
}

export class BasicAuthStrategyFactory implements IAuthStrategyFactory {
  readonly name = StrategyName.BASIC;

  create(config: StrategyConfig): IAuthStrategy {
    if (config.strategy !== StrategyName.BASIC) {
      throw new Error(`BasicAuthStrategyFactory received wrong config type: ${config.strategy}`);
    }
    return new BasicAuthStrategy(config);
  }
}
