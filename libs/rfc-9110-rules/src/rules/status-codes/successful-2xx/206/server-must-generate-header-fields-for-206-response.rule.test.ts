import { NoopLogger } from '@thymian/core';
import { HttpTestApiContext, StaticApiContext } from '@thymian/http-linter';
import { createHttpTestContext } from '@thymian/http-testing';
import {
  exampleContentGenerator,
  identityHookRunner,
} from '@thymian/http-testing/testing-utils';
import {
  buildExampleApp,
  createFastifyRequestRunner,
  exampleAppFormat,
} from '@thymian/test-utils';
import { describe, expect, it } from 'vitest';

import rule from './server-must-generate-header-fields-for-206-response.rule.js';

describe('server-must-generate-header-fields-for-206-response', () => {
  describe('static rule', () => {
    it('should be defined', () => {
      expect(rule.staticRule).toBeTypeOf('function');
    });

    it('should work', () => {
      rule.staticRule?.(
        new StaticApiContext(exampleAppFormat),
        { mode: 'static' },
        new NoopLogger()
      );
    });
  });

  describe('test rule', () => {
    const context = createHttpTestContext({
      format: exampleAppFormat,
      logger: new NoopLogger(),
      runHook: identityHookRunner,
      runRequest: createFastifyRequestRunner(buildExampleApp()),
      generateContent: exampleContentGenerator,
      auth: {
        basic: () => Promise.resolve(['matthyk', 'qupaya']),
      },
      locals: {},
    });

    it('should be defined', () => {
      expect(rule.testRule).toBeTypeOf('function');
    });

    it('should work', async () => {
      const result = await rule.testRule!(
        new HttpTestApiContext(
          'server-must-generate-header-fields-for-206-response',
          context,
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          () => {}
        ),
        { mode: 'test' },
        new NoopLogger()
      );
    });
  });
});
