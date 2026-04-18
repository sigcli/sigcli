import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import-x';

export default tseslint.config(
    // Global ignores
    {
        ignores: [
            'dist/',
            'node_modules/',
            '*.tgz',
            'coverage/',
            '.output/',
            '.nitro/',
            '.tanstack/',
            'website/',
            'sdk/python/',
        ],
    },

    // Base JS recommended rules
    eslint.configs.recommended,

    // TypeScript recommended + type-checked rules
    ...tseslint.configs.recommendedTypeChecked.map((config) => ({
        ...config,
        files: [
            'cli/src/**/*.ts',
            'cli/tests/**/*.ts',
            'sdk/typescript/src/**/*.ts',
            'sdk/typescript/tests/**/*.ts',
        ],
    })),

    // TypeScript parser options — CLI
    {
        files: ['cli/src/**/*.ts', 'cli/tests/**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: ['./cli/tsconfig.json', './cli/tsconfig.test.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // TypeScript parser options — SDK
    {
        files: ['sdk/typescript/src/**/*.ts', 'sdk/typescript/tests/**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: ['./sdk/typescript/tsconfig.json', './sdk/typescript/tsconfig.test.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // Project-specific rules for TypeScript files
    {
        files: [
            'cli/src/**/*.ts',
            'cli/tests/**/*.ts',
            'sdk/typescript/src/**/*.ts',
            'sdk/typescript/tests/**/*.ts',
        ],
        plugins: {
            'import-x': importPlugin,
        },
        rules: {
            'import-x/extensions': ['error', 'ignorePackages'],
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/require-await': 'off',
            'prefer-const': 'error',
            'no-var': 'error',
            'no-control-regex': 'off',
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
        files: ['cli/tests/**/*.ts', 'sdk/typescript/tests/**/*.ts'],
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
        files: ['cli/bin/**/*.js'],
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
        files: ['cli/bin/**/*.js', '**/*.config.ts', '**/*.config.js', 'eslint.config.js'],
        ...tseslint.configs.disableTypeChecked,
    },

    // Prettier must be last
    prettierConfig,
);
