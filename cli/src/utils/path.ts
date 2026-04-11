import os from 'node:os';
import path from 'node:path';

/**
 * Expand a leading ~ in a path to the user's home directory.
 */
export function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}
