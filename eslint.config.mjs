// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Base JS rules
  js.configs.recommended,

  // TypeScript rules (strict — no `any`, no unused vars, etc.)
  ...tseslint.configs.recommended,

  // Disable rules that conflict with Prettier
  eslintConfigPrettier,

  // Global overrides
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Disallow `any` — use `unknown` with type guards instead
      '@typescript-eslint/no-explicit-any': 'error',

      // Unused vars: allow underscore-prefixed to signal intentional ignoring
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Require explicit return types on exported functions
      '@typescript-eslint/explicit-module-boundary-types': 'warn',

      // Prevent floating promises (important for NestJS async patterns)
      '@typescript-eslint/no-floating-promises': 'error',

      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // No non-null assertions — use proper type narrowing
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },

  // Files to ignore globally
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/prisma/migrations/**',
      '**/*.config.js',
      '**/*.config.cjs',
    ],
  },
);
