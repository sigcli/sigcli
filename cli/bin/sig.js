#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function getVersion() {
    try {
        const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
        return pkg.version || 'unknown';
    } catch {
        return 'unknown';
    }
}

function buildIfNeeded() {
    const distPath = join(rootDir, 'dist', 'index.js');
    if (!existsSync(distPath)) {
        // If no .git directory, this is likely a global install with missing dist/
        const gitDir = join(rootDir, '.git');
        if (!existsSync(gitDir)) {
            console.error('[signet] dist/ directory is missing and this is not a dev checkout.');
            console.error('[signet] Please reinstall: npm install -g signet-auth');
            process.exit(1);
        }

        // Dev checkout: build from source
        console.error('[signet] Building project...');
        try {
            execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
        } catch (e) {
            console.error('[signet] Build failed:', e.message);
            process.exit(1);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--version') || args.includes('-v')) {
        console.log(getVersion());
        process.exit(0);
    }

    buildIfNeeded();

    const { run } = await import(join(rootDir, 'dist', 'cli', 'main.js'));
    await run(args);
}

// Graceful shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
process.on('unhandledRejection', (err) => {
    console.error('[signet] Unhandled rejection:', err);
    process.exit(1);
});

main();
