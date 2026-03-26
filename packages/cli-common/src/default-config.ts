import type { ThymianConfig } from './thymian-config.js';

export const defaultConfig: ThymianConfig = {
  plugins: {
    '@thymian/http-linter': {},
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
    '@thymian/http-tester': {},
    '@thymian/http-analyzer': {},
  },
};
