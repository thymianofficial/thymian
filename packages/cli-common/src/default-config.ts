import type { ThymianConfig } from './thymian-config.js';

export const defaultConfig: ThymianConfig = {
  plugins: {
    '@thymian/http-linter': {
      options: {
        rules: ['@thymian/rfc-9110-rules'],
        ruleOptions: {
          'rfc9110/server-must-send-www-authenticate-header-for-401-response': {
            checkAllSecured: false,
          },
        },
      },
    },
    '@thymian/openapi': {
      options: {
        descriptions: [],
      },
    },
    '@thymian/request-dispatcher': {},
    '@thymian/sampler': {},
    '@thymian/reporter': {
      options: {
        formatters: {
          cli: {},
        },
      },
    },
    '@thymian/format-validator': {},
    '@thymian/websocket-proxy': {},
  },
};
