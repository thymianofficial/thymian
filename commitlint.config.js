export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'cli',
        'core',
        'libs',
        'plugins',
        'shared',
        'cli-common',

        'http-testing',
        'rfc-9110-rules',
        'reporter',
        'format-validator',
        'http-linter',
        'openapi',
        'request-dispatcher',
        'sampler',
        'test-utils',
        'repo',
        'release',
        'websocket-proxy',
      ],
    ],
    'scope-empty': [2, 'never'],
  },
};
