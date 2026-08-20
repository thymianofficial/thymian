import baseConfig from '../../eslint.config.mjs';

const noNodePathMessage =
  "Only URL paths are handled here, and node:path is platform dependent (it joins with '\\' on Windows) and resolves '.'/'..' segments. Use joinUrlPath from src/url-path.ts instead (see thymian-internal#621).";

export default [
  ...baseConfig,
  {
    files: ['**/src/processors/**/*.ts', '**/src/url-path.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'node:path', message: noNodePathMessage },
            { name: 'path', message: noNodePathMessage },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
          ignoredDependencies: [
            'vitest',
            'openapi-types',
            '@scalar/json-magic',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
