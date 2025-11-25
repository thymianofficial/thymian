export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'repo',
        'release',
        'cli',
        'core',
        'format-validator',
        'http-linter',
        'http-testing',
        'openapi',
        'reporter',
        'request-dispatcher',
        'rfc-9110-rules',
        'sampler',
        'test-utils',
        'websocket-proxy',
      ],
    ],
    'scope-empty': [2, 'never'],
  },
};
