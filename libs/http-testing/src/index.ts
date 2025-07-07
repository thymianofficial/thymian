import type { HttpTestCase } from './http-test-case.js';

export type TestHook = {
  name: string;
  testCase: HttpTestCase;
};

declare module '@thymian/core' {
  interface ThymianActions {
    'http-testing.test-hook': {
      event: TestHook;
      response: HttpTestCase;
    };
  }
}

export * from './http-request-template.js';
export * from './http-test.js';
export * from './http-test-case.js';
export * from './http-test-context.js';
export * from './operators/index.js';
export * from './request-generator/index.js';
export * from './serialize-parameter.js';
export * from './serialize-request.js';
export * as testUtils from './test-utils/index.js';
export * from './validate/index.js';
export * from 'rxjs';
