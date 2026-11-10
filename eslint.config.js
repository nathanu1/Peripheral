import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // legacy/ is the frozen single-file prototype; it has its own test suite.
    ignores: [
      '**/dist/**',
      '**/dev-dist/**',
      'legacy/**',
      '.github/peripheral/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Section 3: no `any` without a comment explaining why (use an eslint-disable with a reason).
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Section 12: the overlay reads from tracker and policy stores, never from perception.
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['apps/web/src/overlay/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/perception/**', '**/perception'],
              message:
                'The overlay must not import from perception/. Read the tracker and policy stores.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/server/**/*.ts', 'scripts/**', '**/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
