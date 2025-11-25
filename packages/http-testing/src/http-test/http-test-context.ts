import type {
  HttpRequest,
  HttpRequestTemplate,
  HttpResponse,
  Logger,
  ThymianFormat,
  ThymianHttpTransaction,
} from '@thymian/core';

import type { HttpTestCase, HttpTestCaseStep } from './http-test-case.js';
import type { HttpTestHooks } from './http-test-hooks.js';
import type { PipelineItem } from './http-test-pipeline.js';

export type GenerateRequestsOptions = {
  authenticate?: boolean;
  validCredentials?: boolean;
};

export type HttpTestContextLocals = Record<PropertyKey, unknown>;

export interface HttpTestContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals,
> {
  format: ThymianFormat;

  logger: Logger;

  locals: Locals;

  sampleRequest(
    transaction: ThymianHttpTransaction,
  ): Promise<HttpRequestTemplate>;

  runRequest(req: HttpRequest): Promise<HttpResponse>;

  runHook<Hook extends keyof HttpTestHooks>(
    name: Hook,
    payload: HttpTestHooks[Hook]['arg'],
  ): Promise<HttpTestHooks[Hook]['return']>;

  skip<Steps extends HttpTestCaseStep[]>(
    testCase: HttpTestCase<Steps>,
    reason?: string,
  ): PipelineItem<HttpTestCase<Steps>, Locals>;

  fail<Steps extends HttpTestCaseStep[]>(
    testCase: HttpTestCase<Steps>,
    reason?: string,
  ): PipelineItem<HttpTestCase<Steps>, Locals>;
}
