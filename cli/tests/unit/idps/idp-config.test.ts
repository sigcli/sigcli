/**
 * idp-config tests — verify get/set/remove round-trip and comment preservation.
 *
 * We mock the shared `../config/document.js` module so we can drive load/save
 * against an in-memory YAML string without touching the real ~/.sig/config.yaml.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';

import { validateConfig } from '../../../src/config/validator.js';
import {
    getIdpMetaEntries,
    removeIdpMetaEntry,
    setIdpMetaEntry,
} from '../../../src/idps/idp-config.js';
import { isErr } from '../../../src/types/index.js';

// Mock the document helpers before importing the module under test.
let currentYaml = '';
vi.mock('../../../src/config/document.js', () => ({
    loadDocument: vi.fn(async () => {
        if (!currentYaml) return new YAML.Document({});
        return YAML.parseDocument(currentYaml);
    }),
    saveDocument: vi.fn(async (doc: YAML.Document) => {
        currentYaml = doc.toString();
    }),
    loadRawContent: vi.fn(async () => currentYaml),
}));

describe('idp-config', () => {
    beforeEach(() => {
        currentYaml = '';
        vi.clearAllMocks();
    });

    describe('getIdpMetaEntries', () => {
        it('returns empty object when no idps section is present', async () => {
            currentYaml = 'browser:\n  browserDataDir: /tmp\n';
            const entries = await getIdpMetaEntries();
            expect(entries).toEqual({});
        });

        it('reads existing idps entries from YAML', async () => {
            currentYaml = [
                'idps:',
                '  idp.example.com:',
                '    label: IDP1',
                '    totp: {}',
                '  github.com:',
                '    label: GitHub',
                '',
            ].join('\n');
            const entries = await getIdpMetaEntries();
            expect(Object.keys(entries).sort()).toEqual(['github.com', 'idp.example.com']);
            expect(entries['idp.example.com'].label).toBe('IDP1');
            expect(entries['idp.example.com'].totp).toBeDefined();
        });
    });

    describe('setIdpMetaEntry', () => {
        it('adds an entry when idps section does not exist', async () => {
            currentYaml = 'browser:\n  browserDataDir: /tmp\n';
            await setIdpMetaEntry('idp.example.com', {
                label: 'IDP1',
                totp: {},
            });
            expect(currentYaml).toContain('idps:');
            expect(currentYaml).toContain('idp.example.com');
            expect(currentYaml).toContain('label: IDP1');
        });

        it('round-trips: set then get returns same entry', async () => {
            await setIdpMetaEntry('idp.example.com', {
                label: 'IDP1',
                totp: {},
            });
            const entries = await getIdpMetaEntries();
            expect(entries['idp.example.com'].label).toBe('IDP1');
            expect(entries['idp.example.com'].totp).toBeDefined();
        });

        it('updates an existing entry in place', async () => {
            currentYaml = [
                'idps:',
                '  idp.example.com:',
                '    label: OLD',
                '    totp: {}',
                '',
            ].join('\n');
            await setIdpMetaEntry('idp.example.com', {
                label: 'NEW',
                totp: {},
            });
            const entries = await getIdpMetaEntries();
            expect(entries['idp.example.com'].label).toBe('NEW');
            expect(entries['idp.example.com'].totp).toBeDefined();
        });
    });

    describe('removeIdpMetaEntry', () => {
        it('returns true and removes the entry when present', async () => {
            currentYaml = [
                'idps:',
                '  idp.example.com:',
                '    label: IDP1',
                '  github.com:',
                '    label: GitHub',
                '',
            ].join('\n');
            const removed = await removeIdpMetaEntry('idp.example.com');
            expect(removed).toBe(true);
            const entries = await getIdpMetaEntries();
            expect(entries['idp.example.com']).toBeUndefined();
            expect(entries['github.com']).toBeDefined();
        });

        it('returns false when the entry does not exist', async () => {
            currentYaml = 'idps:\n  github.com:\n    label: GitHub\n';
            const removed = await removeIdpMetaEntry('idp.example.com');
            expect(removed).toBe(false);
        });
    });

    describe('comment preservation', () => {
        it('preserves comments inside the idps: block across set/save', async () => {
            currentYaml = [
                '# top-of-file comment',
                'idps:',
                '  # inline comment before idp.example.com',
                '  idp.example.com:',
                '    label: IDP1',
                '  github.com:',
                '    label: GitHub',
                '',
            ].join('\n');
            await setIdpMetaEntry('github.com', { label: 'GitHub-updated' });

            expect(currentYaml).toContain('# top-of-file comment');
            expect(currentYaml).toContain('# inline comment before idp.example.com');
            expect(currentYaml).toContain('GitHub-updated');
        });
    });

    describe('validator: rejects secrets in the idps: section', () => {
        const BASE = {
            browser: { browserDataDir: '/tmp/browser' },
            storage: { credentialsDir: '/tmp/creds' },
        };

        it('rejects a top-level idp.secret field', () => {
            const raw = {
                ...BASE,
                idps: {
                    'idp.example.com': { secret: 'SHOULDBEREJECTED' },
                },
            };
            const result = validateConfig(raw);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message.toLowerCase()).toContain('secret');
            }
        });

        it('rejects an idp.totpSecret field', () => {
            const raw = {
                ...BASE,
                idps: {
                    'idp.example.com': { totpSecret: 'SHOULDBEREJECTED' },
                },
            };
            const result = validateConfig(raw);
            expect(isErr(result)).toBe(true);
        });

        it('rejects an idp.totp.secret field', () => {
            const raw = {
                ...BASE,
                idps: {
                    'idp.example.com': {
                        totp: { secret: 'SHOULDBEREJECTED' },
                    },
                },
            };
            const result = validateConfig(raw);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message.toLowerCase()).toContain('totp.secret');
            }
        });

        it('rejects a capitalized top-level Secret field (case-insensitive)', () => {
            const raw = {
                ...BASE,
                idps: {
                    'idp.example.com': { Secret: 'X' },
                },
            };
            const result = validateConfig(raw);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message.toLowerCase()).toContain('secret');
            }
        });

        it('rejects an all-caps TOTPSECRET field (case-insensitive)', () => {
            const raw = {
                ...BASE,
                idps: {
                    'idp.example.com': { TOTPSECRET: 'X' },
                },
            };
            const result = validateConfig(raw);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message.toLowerCase()).toContain('secret');
            }
        });

        it('rejects a capitalized nested totp.Secret field (case-insensitive)', () => {
            const raw = {
                ...BASE,
                idps: {
                    'idp.example.com': { totp: { Secret: 'X' } },
                },
            };
            const result = validateConfig(raw);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message.toLowerCase()).toContain('totp.secret');
            }
        });
    });
});
