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

import rule from './etag-must-have-valid-entity-tag-format.rule.js';

describe('etag-must-have-valid-entity-tag-format', () => {
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
          'etag-must-have-valid-entity-tag-format',
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
