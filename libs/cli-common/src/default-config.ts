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
    '@thymian/openapi': {},
    '@thymian/request-dispatcher': {},
    '@thymian/sampler': {},
    '@thymian/cli-reporter': {},
    '@thymian/format-validator': {},
  },
};
