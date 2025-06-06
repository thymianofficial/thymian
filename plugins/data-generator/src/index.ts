import type { ThymianSchema } from '@thymian/core';

declare module '@thymian/core' {
  interface ThymianHooks {
    'data-generator.generate': {
      args: [string, ThymianSchema];
      returnType: unknown;
    };
  }
}
