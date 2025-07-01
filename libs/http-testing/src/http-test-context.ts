import type {
  HttpRequest,
  HttpResponse,
  Logger,
  Parameter,
  PartialBy,
  ThymianFormat,
  ThymianSchema,
} from '@thymian/core';

import type { HttpRequestTemplate } from './http-request-template.js';
import type { HttpTestInstance } from './http-test.js';
import type {
  HttpTestCase,
  HttpTestCaseStep,
  HttpTestCaseStepTransaction,
  ThymianHttpTransaction,
} from './http-test-case.js';
import { generateRequest as _generateRequest } from './request-generator/generate-request.js';

export interface HttpTestContext {
  format: ThymianFormat;

  logger: Logger;

  generateContent(
    schema: ThymianSchema,
    contentType?: string,
    context?: { reqId?: string; resId?: string }
  ): Promise<{ content: unknown; encoding?: string }>;

  generateRequest(
    format: ThymianFormat,
    transaction: ThymianHttpTransaction
  ): Promise<HttpRequestTemplate>;

  runRequest(req: HttpRequest): Promise<HttpResponse>;

  generateParameterValue(
    name: string,
    type: 'query' | 'path' | 'header' | 'cookie',
    parameter: Parameter
  ): Promise<{ content: unknown; encoding?: string }>;

  runHook(
    name: 'authorize',
    input: HttpTestCaseStepTransaction
  ): Promise<HttpTestCaseStepTransaction>;
  runHook<Input, Output = Input>(name: string, input: Input): Promise<Output>;

  skip<Steps extends HttpTestCaseStep[]>(
    testCase: HttpTestCase<Steps>,
    reason?: string
  ): HttpTestInstance<HttpTestCase<Steps>>;

  fail<Steps extends HttpTestCaseStep[]>(
    testCase: HttpTestCase<Steps>,
    reason?: string
  ): HttpTestInstance<HttpTestCase<Steps>>;

  assertionFailure<Steps extends HttpTestCaseStep[]>(
    testCase: HttpTestCase<Steps>,
    reason?: string
  ): HttpTestInstance<HttpTestCase<Steps>>;

  auth?: {
    basic?: (
      transaction: HttpTestCaseStepTransaction
    ) => Promise<[string, string]>;
  };
}

export function createHttpTestContext<
  Context extends PartialBy<
    Omit<HttpTestContext, 'skip' | 'fail' | 'assertionFailure'>,
    'generateRequest' | 'generateParameterValue'
  >
>(context: Context): HttpTestContext {
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
    ): HttpTestInstance<HttpTestCase<Steps>> {
      testCase.status = 'skipped';
      testCase.reason = reason;

      return {
        ctx: this,
        curr: testCase,
      };
    },
    fail<Steps extends HttpTestCaseStep[]>(
      testCase: HttpTestCase<Steps>,
      reason?: string
    ): HttpTestInstance<HttpTestCase<Steps>> {
      testCase.status = 'failed';
      testCase.reason = reason;

      return {
        ctx: this,
        curr: testCase,
      };
    },
    assertionFailure<Steps extends HttpTestCaseStep[]>(
      testCase: HttpTestCase<Steps>,
      reason: string
    ): HttpTestInstance<HttpTestCase<Steps>> {
      testCase.results.push({
        type: 'assertion-failure',
        message: reason,
      });

      return this.fail(testCase, reason);
    },
    generateRequest(
      format: ThymianFormat,
      transaction: ThymianHttpTransaction
    ) {
      if (context.generateRequest) {
        return context.generateRequest(format, transaction);
      } else {
        return _generateRequest(transaction, this);
      }
    },
  };
}
