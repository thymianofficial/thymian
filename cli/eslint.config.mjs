import baseConfig from '../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
          ignoredDependencies: [
            'vitest',
            'tslib',
            '@oclif/plugin-help',
            '@oclif/plugin-not-found',
            '@oclif/plugin-plugins',
            '@oclif/plugin-version',
            '@thymian/cli-reporter',
            '@thymian/format-validator',
            '@thymian/openapi',
            '@oclif/plugin-version',
            '@thymian/rfc-9110-rules',
            '@thymian/http-linter',
            '@thymian/sampler',
            '@thymian/websocket-proxy',
            '@thymian/reporter',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
