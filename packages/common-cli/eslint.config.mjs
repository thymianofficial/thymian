import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Deliberately unparseable — a fixture for a genuine TypeScript syntax error (story 34.4).
    // Scoped to this package's own config (not the shared root one) since ESLint resolves
    // `ignores` patterns relative to the cwd `eslint` actually runs from, which for this project
    // is `packages/common-cli` — a pattern here can be package-relative and unambiguous, where the
    // same pattern in the shared root config would have to be `**/`-prefixed and would then match
    // this same relative path in any other package too.
    ignores: ['test/fixtures/plugins/syntax-error-plugin.ts'],
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
          ignoredDependencies: ['tslib', 'vitest'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
