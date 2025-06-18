import type {
  Logger,
  Parameter,
  PartialBy,
  ThymianFormat,
  ThymianHttpRequest,
  ThymianSchema,
} from '@thymian/core';

import type { HttpRequestTemplate } from './http-request-template.js';
import type { HttpResponse } from './http-response.js';
import type {
  HttpTestCase,
  HttpTestCaseStep,
  HttpTestCaseTransaction,
  ThymianHttpTransaction,
} from './http-test-case.js';
import {
  generateRequest as defaultRequestGenerator,
  generateRequestForTransactions as defaultTransactionGenerator,
} from './request-generator/generate.js';
import type { HttpRequest } from './http-request.js';
import type { HttpTestInstance } from './http-test.js';

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

  generateRequestFor(reqId: string): Promise<HttpRequestTemplate>;

  runRequest(req: HttpRequest): Promise<HttpResponse>;

  generateParameterValue(
    name: string,
    type: 'query' | 'path' | 'header' | 'cookie',
    parameter: Parameter
  ): Promise<{ content: unknown; encoding?: string }>;

  runHook(
    name: 'authorize',
    input: HttpTestCaseTransaction
  ): Promise<HttpTestCaseTransaction>;
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
    basic?: (transaction: HttpTestCaseTransaction) => Promise<[string, string]>;
  };
}

export function createHttpTestContext<
  Context extends PartialBy<
    Omit<HttpTestContext, 'skip' | 'fail'>,
    'generateRequest' | 'generateRequestFor' | 'generateParameterValue'
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

  const generateRequestFor =
    context.generateRequestFor ??
    function generateRequestFor(reqId: string) {
      const req = context.format.getNode<ThymianHttpRequest>(reqId);

      if (typeof req === 'undefined') {
        throw new Error('Cannot generate request for id ' + reqId);
      }

      return defaultRequestGenerator(
        context.format,
        reqId,
        context.generateContent,
        generateParameterValue
      );
    };

  const generateRequest =
    context.generateRequest ??
    function generateRequest(
      format: ThymianFormat,
      transaction: ThymianHttpTransaction
    ): Promise<HttpRequestTemplate> {
      return defaultTransactionGenerator(
        format,
        transaction,
        context.generateContent,
        generateParameterValue
      );
    };

  return {
    ...context,
    generateRequest,
    generateRequestFor,
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
  };
}
