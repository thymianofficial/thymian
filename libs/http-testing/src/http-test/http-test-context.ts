import type {
  HttpRequest,
  HttpResponse,
  Logger,
  Parameter,
  ThymianFormat,
  ThymianHttpTransaction,
  ThymianSchema,
} from '@thymian/core';

import type { HttpRequestTemplate } from '../http-request-template.js';
import type {
  HttpTestCase,
  HttpTestCaseStep,
  HttpTestCaseStepTransaction,
} from './http-test-case.js';
import type { HttpTestHooks } from './http-test-hooks.js';
import type { PipelineItem } from './http-test-pipeline.js';

export type GenerateRequestsOptions = {
  authenticate?: boolean;
  validCredentials?: boolean;
};

export type HttpTestContextLocals = Record<PropertyKey, unknown>;

export interface HttpTestContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals
> {
  format: ThymianFormat;

  logger: Logger;

  locals: Locals;

  generateContent(
    schema: ThymianSchema,
    contentType?: string,
    context?: { reqId?: string; resId?: string }
  ): Promise<{ content: unknown; encoding?: string }>;

  generateRequest(
    format: ThymianFormat,
    transaction: ThymianHttpTransaction,
    options?: GenerateRequestsOptions
  ): Promise<HttpRequestTemplate>;

  runRequest(req: HttpRequest): Promise<HttpResponse>;

  generateParameterValue(
    name: string,
    type: 'query' | 'path' | 'header' | 'cookie',
    parameter: Parameter
  ): Promise<{ content: unknown; encoding?: string }>;

  runHook<Hook extends keyof HttpTestHooks>(
    name: Hook,
    payload: HttpTestHooks[Hook]['arg']
  ): Promise<HttpTestHooks[Hook]['return']>;

  skip<Steps extends HttpTestCaseStep[]>(
    testCase: HttpTestCase<Steps>,
    reason?: string
  ): PipelineItem<HttpTestCase<Steps>, Locals>;

  fail<Steps extends HttpTestCaseStep[]>(
    testCase: HttpTestCase<Steps>,
    reason?: string
  ): PipelineItem<HttpTestCase<Steps>, Locals>;

  auth?: {
    basic?: (
      transaction: HttpTestCaseStepTransaction
    ) => Promise<[string, string]>;
  };
}
