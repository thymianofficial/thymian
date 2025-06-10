import {
  type Logger,
  type PartialBy,
  ThymianFormat,
  type ThymianHttpRequest,
  ThymianSchema,
} from '@thymian/core';

import type { HttpRequestTemplate } from './http-request-template.js';
import type { HttpResponse } from './http-response.js';
import type {
  HttpTestCaseTransaction,
  ThymianHttpTestTransaction,
} from './http-test-case.js';
import {
  generateRequest as defaultRequestGenerator,
  generateRequestForTransactions as defaultTransactionGenerator,
} from './request-generator/generate.js';
import type { HttpRequest } from './run-requests.js';

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
    transaction: ThymianHttpTestTransaction
  ): Promise<HttpRequestTemplate>;

  generateRequestFor(reqId: string): Promise<HttpRequestTemplate>;

  runRequest(req: HttpRequest): Promise<HttpResponse>;

  runHook(
    name: 'authorize',
    input: HttpTestCaseTransaction
  ): Promise<HttpTestCaseTransaction>;
  runHook<Input, Output = Input>(name: string, input: Input): Promise<Output>;

  auth?: {
    basic?: (transaction: HttpTestCaseTransaction) => Promise<[string, string]>;
  };
}

export function createHttpTestContext<
  Context extends PartialBy<
    HttpTestContext,
    'generateRequest' | 'generateRequestFor'
  >
>(context: Context): HttpTestContext {
  const generateRequest =
    context.generateRequest ??
    function generateRequest(
      format: ThymianFormat,
      transaction: ThymianHttpTestTransaction
    ): Promise<HttpRequestTemplate> {
      return defaultTransactionGenerator(
        format,
        transaction,
        context.generateContent
      );
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
        context.generateContent
      );
    };

  return {
    generateRequest,
    generateRequestFor,
    ...context,
  };
}
