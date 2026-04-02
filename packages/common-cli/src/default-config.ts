import type { ThymianConfig } from './thymian-config.js';

export const defaultConfig: ThymianConfig = {
  specifications: [],
  traffic: [],
  ruleSets: ['@thymian/rules-rfc-9110'],
  ruleSeverity: 'error',
  rules: {},
  plugins: {
    '@thymian/plugin-http-linter': {},
    '@thymian/plugin-openapi': {
      options: {
        descriptions: [],
      },
    },
    '@thymian/plugin-request-dispatcher': {},
    '@thymian/plugin-sampler': {},
    '@thymian/plugin-reporter': {
      options: {
        formatters: {
          text: {},
        },
      },
    },
    '@thymian/plugin-http-tester': {},
    '@thymian/plugin-http-analyzer': {},
  },
};
