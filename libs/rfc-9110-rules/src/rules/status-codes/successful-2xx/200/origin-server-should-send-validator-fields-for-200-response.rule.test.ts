import { NoopLogger } from '@thymian/core';
import { HttpTestApiContext } from '@thymian/http-linter';
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

import rule from '../206/server-must-generate-header-fields-for-206-response.rule.js';

describe('server-must-generate-header-fields-for-206-response', () => {
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
      const result = await rule.testRule?.(
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
