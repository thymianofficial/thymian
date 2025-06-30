import type { ThymianConfig } from './thymian-config.js';

export const defaultConfig: ThymianConfig = {
  plugins: {
    '@thymian/http-linter': {
      options: {
        rules: ['@thymian/rfc-9110-rules'],
        ruleOptions: {},
      },
    },
    '@thymian/openapi': {},
    '@thymian/request-dispatcher': {},
    '@thymian/sampler': {},
  },
};
