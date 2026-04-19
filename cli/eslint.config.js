import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import-x';

export default tseslint.config(
    // Global ignores
    {
        ignores: ['dist/', 'node_modules/', '*.tgz', 'coverage/'],
    },

    // Base JS recommended rules
    eslint.configs.recommended,

    // TypeScript recommended + type-checked rules for src/ and tests/
    ...tseslint.configs.recommendedTypeChecked.map((config) => ({
        ...config,
        files: ['src/**/*.ts', 'tests/**/*.ts'],
    })),

    // TypeScript parser options
    {
        files: ['src/**/*.ts', 'tests/**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.json', './tsconfig.test.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // Project-specific rules for TypeScript files
    {
        files: ['src/**/*.ts', 'tests/**/*.ts'],
        plugins: {
            'import-x': importPlugin,
        },
        rules: {
            // Enforce .js extensions in relative imports (critical ESM convention)
            'import-x/extensions': ['error', 'ignorePackages'],

            // Allow unused vars with _ prefix
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],

            // Warn on explicit any — the project uses it judiciously
            '@typescript-eslint/no-explicit-any': 'warn',

            // Allow non-null assertions with a warning
            '@typescript-eslint/no-non-null-assertion': 'warn',

            // Catch floating promises, but allow void-prefixed fire-and-forget
            '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],

            // Allow empty functions (common in test mocks and null adapter)
            '@typescript-eslint/no-empty-function': 'off',

            // Allow async methods without await (needed for interface conformance)
            '@typescript-eslint/require-await': 'off',

            // Enforce const where possible
            'prefer-const': 'error',

            // No var declarations
            'no-var': 'error',

            // Allow ANSI escape sequences in regex (used in formatters)
            'no-control-regex': 'off',

            // Warn on unsafe any usage — project uses JSON.parse/dynamic data legitimately
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-base-to-string': 'warn',
        },
    },

    // Relaxed rules for test files
    {
        files: ['tests/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/unbound-method': 'off',
        },
    },

    // Node.js globals for bin/ scripts
    {
        files: ['bin/**/*.js'],
        languageOptions: {
            globals: {
                console: 'readonly',
                process: 'readonly',
                URL: 'readonly',
            },
        },
    },

    // Plain JS and config files — disable type-checked rules
    {
        files: ['bin/**/*.js', '**/*.config.ts', '**/*.config.js', 'eslint.config.js'],
        ...tseslint.configs.disableTypeChecked,
    },

    // Prettier must be last to override conflicting style rules
    prettierConfig,
);
