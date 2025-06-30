import type { ThymianConfig } from './thymian-config.js';

export const defaultConfig: ThymianConfig = {
  plugins: {
    '@thymian/http-linter': {
      options: {
        rules: [],
        ruleOptions: {},
      },
    },
    '@thymian/openapi': {},
    '@thymian/request-dispatcher': {},
    '@thymian/sampler': {},
  },
};
