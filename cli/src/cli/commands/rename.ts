import type { AuthDeps } from '../../deps.js';
import { renameProviderInConfig } from '../../config/loader.js';

export async function runRename(
  positionals: string[],
  _flags: Record<string, string | boolean>,
  deps: AuthDeps,
): Promise<void> {
  const oldId = positionals[0];
  const newId = positionals[1];

  if (!oldId || !newId) {
    process.stderr.write('Usage: sig rename <old-id> <new-id>\n');
    process.exitCode = 1;
    return;
  }

  // Resolve old provider
  const provider = deps.authManager.providerRegistry.resolveFlexible(oldId);
  if (!provider) {
    process.stderr.write(`Error: No provider found matching "${oldId}".\n`);
    process.exitCode = 1;
    return;
  }

  // Check new ID doesn't collide
  const existing = deps.authManager.providerRegistry.get(newId);
  if (existing) {
    process.stderr.write(`Error: Provider "${newId}" already exists.\n`);
    process.exitCode = 1;
    return;
  }

  const resolvedOldId = provider.id;

  // Move credential in storage
  const stored = await deps.storage.get(resolvedOldId);
  if (stored) {
    stored.providerId = newId;
    await deps.storage.set(newId, stored);
    await deps.storage.delete(resolvedOldId);
  }

  // Update in-memory registry (shallow copy to avoid mutating the original)
  deps.authManager.providerRegistry.unregister(resolvedOldId);
  const updated = {
    ...provider,
    id: newId,
    name: provider.name === resolvedOldId ? newId : provider.name,
  };
  deps.authManager.providerRegistry.register(updated);

  // Update config.yaml
  await renameProviderInConfig(resolvedOldId, newId);

  process.stderr.write(`Renamed "${resolvedOldId}" → "${newId}".\n`);
}
