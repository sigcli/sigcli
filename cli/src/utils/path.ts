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

/**
 * Encode a filesystem path as a directory name for project-namespaced storage.
 * Mirrors ~/.claude's convention: /Users/foo/bar → -Users-foo-bar
 */
export function encodeProjectPath(projectRoot: string): string {
    return '-' + projectRoot.replace(/^\//, '').replace(/\//g, '-');
}
