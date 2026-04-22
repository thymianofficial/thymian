import baseConfig from '../../eslint.config.mjs';

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
            '@thymian/plugin-openapi',
            '@oclif/plugin-version',
            '@thymian/rules-rfc-9110',
            '@thymian/plugin-http-linter',
            '@thymian/plugin-http-tester',
            '@thymian/plugin-http-analyzer',
            '@thymian/plugin-request-dispatcher',
            '@thymian/plugin-sampler',
            '@thymian/plugin-websocket-proxy',
            '@thymian/plugin-reporter',
            '@thymian/evaluation',
            '@thymian/rules-api-description-validation',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
