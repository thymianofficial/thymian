import type { Logger } from 'src/logger/logger.js';

import { ThymianEmitter } from '../../emitter/index.js';
import {
  ThymianFormat,
  type ThymianHttpTransaction,
} from '../../format/index.js';
import type {
  HttpRequest,
  HttpRequestTemplate,
  HttpResponse,
} from '../../http.js';
import { createHttpTestHookRunnerFromThymianEmitter } from './create-hook-runner.js';
import type { HttpTestCase, HttpTestCaseStep } from './http-test-case.js';
import type {
  HttpTestContext,
  HttpTestContextLocals,
} from './http-test-context.js';
import type { PipelineItem } from './http-test-pipeline.js';

export function createHttpTestContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals,
>(
  context: Omit<HttpTestContext<Locals>, 'skip' | 'fail'>,
): HttpTestContext<Locals> {
  return {
    ...context,
    skip<Steps extends HttpTestCaseStep[]>(
      testCase: HttpTestCase<Steps>,
      reason?: string,
    ): PipelineItem<HttpTestCase<Steps>, Locals> {
      testCase.status = 'skipped';
      testCase.reason = reason;
      testCase.end = performance.now();

      return {
        ctx: this,
        current: testCase,
      };
    },
    fail<Steps extends HttpTestCaseStep[]>(
      testCase: HttpTestCase<Steps>,
      reason?: string,
    ): PipelineItem<HttpTestCase<Steps>, Locals> {
      testCase.status = 'failed';
      testCase.reason = reason;
      testCase.end = performance.now();

      return {
        ctx: this,
        current: testCase,
      };
    },
  };
}

export function createContextFromEmitter<Locals extends HttpTestContextLocals>(
  format: ThymianFormat,
  logger: Logger,
  emitter: ThymianEmitter,
  origin?: string,
  locals: Locals = {} as Locals,
) {
  return createHttpTestContext({
    format,
    logger,
    locals,
    sampleRequest: async function (
      transaction: ThymianHttpTransaction,
    ): Promise<HttpRequestTemplate> {
      return await emitter.emitAction(
        'core.request.sample',
        { transaction },
        { strategy: 'first' },
      );
    },
    runRequest: async function (req: HttpRequest): Promise<HttpResponse> {
      const finalOrigin = origin ?? req.origin;
      return await emitter.emitAction(
        'core.request.dispatch',
        {
          request: {
            ...req,
            origin: finalOrigin,
          },
        },
        {
          strategy: 'first',
        },
      );
    },
    runHook: createHttpTestHookRunnerFromThymianEmitter(emitter),
  });
}
