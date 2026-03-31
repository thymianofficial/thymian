import type { ThymianConfig } from './thymian-config.js';

export const defaultConfig: ThymianConfig = {
  specifications: [],
  traffic: [],
  ruleSets: ['@thymian/rfc-9110-rules'],
  ruleSeverity: 'error',
  rules: {},
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
          text: {},
        },
      },
    },
    '@thymian/http-tester': {},
    '@thymian/http-analyzer': {},
  },
};
