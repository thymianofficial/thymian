import { NoopLogger } from '@thymian/core';
import { HttpTestApiContext, StaticApiContext } from '@thymian/http-linter';
import { createHttpTestContext } from '@thymian/http-testing';
import {
  createRequestRunner,
  exampleContentGenerator,
  identityHookRunner,
} from '@thymian/http-testing/test-utils';
import { buildExampleApp, exampleAppFormat } from '@thymian/test-utils';
import { describe, expect, it } from 'vitest';

import rule from './sender-should-not-generate-additional-representation-header-fields-for-206-response.rule.js';

describe('sender-should-not-generate-additional-representation-header-fields-for-206-response', () => {
  describe('static rule', () => {
    it('should be defined', () => {
      expect(rule.staticRule).toBeTypeOf('function');
    });

    it('should work', async () => {
      await rule.staticRule?.(
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
      runRequest: createRequestRunner(buildExampleApp()),
      generateContent: exampleContentGenerator,
      auth: {
        basic: () => Promise.resolve(['matthyk', 'qupaya']),
      },
    });

    it('should be defined', () => {
      expect(rule.testRule).toBeTypeOf('function');
    });

    it('should work', async () => {
      const result = await rule.testRule?.(
        new HttpTestApiContext(
          'sender-should-not-generate-additional-representation-header-fields-for-206-response',
          context
        ),
        { mode: 'test' },
        new NoopLogger()
      );
    });
  });
});
