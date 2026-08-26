import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Deliberately, genuinely invalid JavaScript (AC4 fixture: a real
    // SyntaxError, not a mislabeled-but-valid file) — ESLint cannot parse it,
    // and it must never pass lint.
    ignores: ['test/rules/fixtures/rule-sets/glob-syntax-error/broken.rule.mjs'],
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
            'graphology-types',
            '@fastify/deepmerge',
            'graphology',
            'rxjs',
            'ajv-formats',
            'secure-json-parse',
            'url-template',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
