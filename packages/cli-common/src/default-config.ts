import type { ThymianConfig } from './thymian-config.js';

export const defaultConfig: ThymianConfig = {
  plugins: {
    '@thymian/http-linter-plugin': {
      options: {
        ruleSets: ['@thymian/rfc-9110-rules'],
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
    '@thymian/api-description-validation-rules': {},
    '@thymian/http-tester-plugin': {
      options: {
        ruleSets: [
          '@thymian/rfc-9110-rules',
          '@thymian/api-description-validation-rules',
        ],
      },
    },
    '@thymian/http-analyzer-plugin': {
      options: {
        ruleSets: [
          '@thymian/rfc-9110-rules',
          '@thymian/api-description-validation-rules',
        ],
      },
    },
  },
};
