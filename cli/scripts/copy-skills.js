import { readdirSync, statSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SKILLS_SRC = join(__dirname, '../../skills');
const SKILLS_DEST = join(__dirname, '../dist/skills');

const EXCLUDE_DIRS = new Set(['tests', '__pycache__', 'node_modules']);

// Discover skills: directories containing SKILL.md
const skills = readdirSync(SKILLS_SRC).filter((name) => {
    const p = join(SKILLS_SRC, name);
    return statSync(p).isDirectory() && existsSync(join(p, 'SKILL.md'));
});

// Clean and recreate dest
if (existsSync(SKILLS_DEST)) rmSync(SKILLS_DEST, { recursive: true });
mkdirSync(SKILLS_DEST, { recursive: true });

for (const skill of skills) {
    cpSync(join(SKILLS_SRC, skill), join(SKILLS_DEST, skill), {
        recursive: true,
        filter: (src) => {
            const b = basename(src);
            return !EXCLUDE_DIRS.has(b) && !b.endsWith('.pyc');
        },
    });
    process.stderr.write(`  + ${skill}\n`);
}

process.stderr.write(`\nBundled ${skills.length} skills to ${SKILLS_DEST}\n`);
