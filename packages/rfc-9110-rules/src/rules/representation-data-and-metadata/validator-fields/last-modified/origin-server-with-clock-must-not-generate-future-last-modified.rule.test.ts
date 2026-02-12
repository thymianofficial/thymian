import { NoopLogger } from '@thymian/core';
import { HttpTestApiContext } from '@thymian/http-linter';
import { createHttpTestContext } from '@thymian/http-testing';
import {
  exampleRequestSampler,
  identityHookRunner,
} from '@thymian/http-testing/testing-utils';
import {
  buildExampleApp,
  createFastifyRequestRunner,
  exampleAppFormat,
} from '@thymian/test-utils';
import { describe, expect, it } from 'vitest';

import rule from './origin-server-with-clock-must-not-generate-future-last-modified.rule.js';

describe('origin-server-with-clock-must-not-generate-future-last-modified', () => {
  describe('test rule', () => {
    const context = createHttpTestContext({
      format: exampleAppFormat,
      logger: new NoopLogger(),
      runHook: identityHookRunner,
      runRequest: createFastifyRequestRunner(buildExampleApp()),
      sampleRequest: exampleRequestSampler,
      locals: {},
    });

    it('should be defined', () => {
      expect(rule.testRule).toBeTypeOf('function');
    });

    it('should work', async () => {
      const result = await rule.testRule?.(
        new HttpTestApiContext(
          'origin-server-with-clock-must-not-generate-future-last-modified',
          context,
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          () => {},
        ),
        { mode: 'test' },
        new NoopLogger(),
      );
    });
  });
});
