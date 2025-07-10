import { describe, expect, it } from 'vitest';

import rule from './server-must-generate-header-fields-for-206-response.rule.js';

import { NoopLogger } from '@thymian/core';
import { StaticApiContext, HttpTestApiContext } from '@thymian/http-linter';
import { buildExampleApp, exampleAppFormat } from '@thymian/test-utils';
import { createHttpTestContext } from '@thymian/http-testing';
import {
  createRequestRunner,
  exampleContentGenerator,
  identityHookRunner,
} from '@thymian/http-testing/test-utils';

describe('server-must-generate-header-fields-for-206-response', () => {
  describe('static rule', () => {
    it('should be defined', () => {
      expect(rule.staticRule).toBeTypeOf('function');
    });

    it('should work', () => {
      const result = rule.staticRule!(
        new StaticApiContext(exampleAppFormat),
        { mode: 'static' },
        new NoopLogger()
      );
    });
  });

  /*
  context = createHttpTestContext({
      format: todoFormat,
      logger: new NoopLogger(),
      runHook: identityHookRunner,
      runRequest: createRequestRunner(todoApp),
      generateContent: exampleContentGenerator,
      auth: {
        basic: () => Promise.resolve(['matthyk', 'qupaya']),
      },
    });
   */

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
      const result = await rule.testRule!(
        new HttpTestApiContext(
          'server-must-generate-header-fields-for-206-response',
          context
        ),
        { mode: 'test' },
        new NoopLogger()
      );

      expect(result).toHaveLength(2);

      console.log(JSON.stringify(result));
    });
  });
});
