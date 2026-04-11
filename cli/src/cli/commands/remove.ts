import { createInterface } from 'node:readline';
import type { AuthDeps } from '../../deps.js';
import type { ProviderConfig } from '../../core/types.js';
import { removeProviderFromConfig } from '../../config/loader.js';
import { ExitCode } from '../exit-codes.js';

export async function runRemove(
  positionals: string[],
  flags: Record<string, string | boolean | string[]>,
  deps: AuthDeps,
): Promise<void> {
  if (positionals.length === 0) {
    process.stderr.write('Usage: sig remove <provider> [...providers] [--force] [--keep-config]\n');
    process.exitCode = ExitCode.GENERAL_ERROR;
    return;
  }

  // Resolve each positional
  const resolved: ProviderConfig[] = [];
  const unknown: string[] = [];

  for (const input of positionals) {
    const provider = deps.authManager.providerRegistry.resolveFlexible(input);
    if (provider) {
      resolved.push(provider);
    } else {
      unknown.push(input);
    }
  }

  if (unknown.length > 0) {
    process.stderr.write(`Unknown provider(s): ${unknown.join(', ')}\n`);
    process.exitCode = ExitCode.GENERAL_ERROR;
    return;
  }

  // Confirmation (unless --force)
  const force = flags.force === true;
  if (!force) {
    if (!process.stdin.isTTY) {
      process.stderr.write('Cannot confirm interactively. Use --force to skip confirmation.\n');
      process.exitCode = ExitCode.GENERAL_ERROR;
      return;
    }

    const ids = resolved.map(p => p.id).join(', ');
    const confirmed = await new Promise<boolean>((resolve) => {
      const rl = createInterface({ input: process.stdin, output: process.stderr });
      rl.question(`Remove ${resolved.length} provider(s)? ${ids} [y/N] `, (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
      });
    });

    if (!confirmed) {
      process.stderr.write('Aborted.\n');
      return;
    }
  }

  // Remove each provider
  const keepConfig = flags['keep-config'] === true;
  const errors: string[] = [];
  let removed = 0;

  for (const provider of resolved) {
    try {
      await deps.storage.delete(provider.id);
      deps.authManager.providerRegistry.unregister(provider.id);
      if (!keepConfig) {
        await removeProviderFromConfig(provider.id);
      }
      removed++;
    } catch (e) {
      errors.push(`${provider.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (removed > 0) {
    process.stderr.write(`Removed ${removed} provider(s).\n`);
  }
  if (errors.length > 0) {
    process.stderr.write(`Failed to remove: ${errors.join('; ')}\n`);
    process.exitCode = ExitCode.GENERAL_ERROR;
  }
}
