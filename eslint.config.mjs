import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-release/**', 'releases/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/ports/**/*.ts', 'src/engine/**/*.ts', 'src/application/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'chrome', message: 'Pure core layers must use Ports instead of global chrome.*' },
        { name: 'window', message: 'Pure core layers must not depend on window' },
        { name: 'document', message: 'Pure core layers must not depend on document' },
        { name: 'localStorage', message: 'Pure core layers must use StoragePort instead of localStorage' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/adapters/**', '**/ui/**', '**/background/**'],
              message: 'Core layers (domain/ports/engine/application) must not depend on outer adapters/ui/background.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: 'readonly',
      },
    },
  },
  {
    files: ['src/background/**/*.ts', 'src/adapters/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        chrome: 'readonly',
      },
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['public/theme-boot.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['*.config.{ts,mjs}', 'src/manifest.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
