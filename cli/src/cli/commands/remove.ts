import { createInterface } from 'node:readline';
import type { AuthDeps } from '../../deps.js';
import type { ProviderConfig } from '../../core/types.js';
import { removeProviderFromConfig } from '../../config/loader.js';

export async function runRemove(
  positionals: string[],
  flags: Record<string, string | boolean | string[]>,
  deps: AuthDeps,
): Promise<void> {
  if (positionals.length === 0) {
    process.stderr.write('Usage: sig remove <provider> [...providers] [--force] [--keep-config]\n');
    process.exitCode = 1;
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
    process.exitCode = 1;
    return;
  }

  // Confirmation (unless --force)
  const force = flags.force === true;
  if (!force) {
    if (!process.stdin.isTTY) {
      process.stderr.write('Cannot confirm interactively. Use --force to skip confirmation.\n');
      process.exitCode = 1;
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
  for (const provider of resolved) {
    await deps.storage.delete(provider.id);
    deps.authManager.providerRegistry.unregister(provider.id);
    if (!keepConfig) {
      await removeProviderFromConfig(provider.id);
    }
  }

  process.stderr.write(`Removed ${resolved.length} provider(s).\n`);
}
