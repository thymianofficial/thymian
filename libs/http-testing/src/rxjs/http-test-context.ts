import {
  type Logger,
  type PartialBy,
  ThymianFormat,
  ThymianSchema,
} from '@thymian/core';

import type { HttpRequestTemplate } from './http-request-template.js';
import type { ThymianHttpTestTransaction } from './http-test-case.js';
import { generateRequest } from './request-generator/generate.js';

export interface HttpTestContext {
  format: ThymianFormat;

  logger: Logger;

  generateContent(
    schema: ThymianSchema,
    contentType?: string,
    context?: { reqId: string; resId: string }
  ): Promise<{ content: unknown; encoding?: string }>;

  generateRequest(
    format: ThymianFormat,
    transaction: ThymianHttpTestTransaction
  ): Promise<HttpRequestTemplate>;

  generateRequestFor(reqId: string): Promise<HttpRequestTemplate>;
}

export function createHttpTestContext(
  context: PartialBy<HttpTestContext, 'generateRequest'>
): HttpTestContext {
  return {
    generateRequest(
      format: ThymianFormat,
      transaction: ThymianHttpTestTransaction
    ): Promise<HttpRequestTemplate> {
      return generateRequest(format, transaction, context.generateContent);
    },
    ...context,
  };
}
