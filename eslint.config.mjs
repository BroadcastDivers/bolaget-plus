import eslint from '@eslint/js';
import perfectionist from 'eslint-plugin-perfectionist';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/*.js',
      '.output/**',
      '.wxt/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Not part of the TypeScript project, but still worth linting.
          allowDefaultProject: ['eslint.config.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
    },
  },
  perfectionist.configs['recommended-natural'],
  {
    // This file isn't type-checked by tsc, and the type-aware rules only have
    // the plugins' own declarations to work from — which yields findings about
    // eslint's and perfectionist's typings rather than about this config.
    extends: [tseslint.configs.disableTypeChecked],
    files: ['**/*.mjs'],
  }
);
