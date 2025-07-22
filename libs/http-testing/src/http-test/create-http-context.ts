import type {
  Parameter,
  PartialBy,
  ThymianFormat,
  ThymianHttpTransaction,
} from '@thymian/core';

import { generateRequest as _generateRequest } from '../generate-request.js';
import type { HttpTestCase, HttpTestCaseStep } from './http-test-case.js';
import type {
  GenerateRequestsOptions,
  HttpTestContext,
  HttpTestContextLocals,
} from './http-test-context.js';
import type { PipelineItem } from './http-test-pipeline.js';

export function createHttpTestContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals
>(
  context: PartialBy<
    Omit<HttpTestContext<Locals>, 'skip' | 'fail' | 'assertionFailure'>,
    'generateRequest' | 'generateParameterValue'
  >
): HttpTestContext {
  const generateParameterValue =
    context.generateParameterValue ??
    function generateParameterValue(
      name: string,
      type: 'query' | 'path' | 'header' | 'cookie',
      parameter: Parameter
    ) {
      return context.generateContent(parameter.schema);
    };

  return {
    ...context,
    generateParameterValue,
    skip<Steps extends HttpTestCaseStep[]>(
      testCase: HttpTestCase<Steps>,
      reason?: string
    ): PipelineItem<HttpTestCase<Steps>, Locals> {
      testCase.status = 'skipped';
      testCase.reason = reason;

      return {
        ctx: this,
        current: testCase,
      };
    },
    fail<Steps extends HttpTestCaseStep[]>(
      testCase: HttpTestCase<Steps>,
      reason?: string
    ): PipelineItem<HttpTestCase<Steps>, Locals> {
      testCase.status = 'failed';
      testCase.reason = reason;

      return {
        ctx: this,
        current: testCase,
      };
    },
    generateRequest(
      format: ThymianFormat,
      transaction: ThymianHttpTransaction,
      options?: GenerateRequestsOptions
    ) {
      if (context.generateRequest) {
        return context.generateRequest(format, transaction);
      } else {
        return _generateRequest(transaction, this, options);
      }
    },
  } satisfies HttpTestContext<Locals>;
}
