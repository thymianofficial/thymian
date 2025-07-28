import type { HttpTestCase } from './http-test/index.js';

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

export * from './http-test/index.js';
export * from './operators/index.js';
export * from './test-builder/single-step-test-builder.js';
export * from './request-generator/index.js';
export * from './serialize-parameter.js';
export * from './serialize-request.js';
export * as testUtils from './testing-utils/index.js';
export * from './validate/index.js';
export * from 'rxjs';
