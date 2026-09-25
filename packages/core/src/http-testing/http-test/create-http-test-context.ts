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
import type { Logger } from '../../logger/logger.js';
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
    /**
     * The override lands on the **template**, not only on the dispatched
     * request.
     *
     * The template is what hooks are handed, and what a `utils.request` seed
     * inherits its origin from. Applied at dispatch alone, the run itself went
     * to `--target-url` while every seed a hook sent went to the server the
     * description names — so a seeded fixture existed on one server and the
     * transaction that needed it ran against another.
     */
    sampleRequest: async function (
      transaction: ThymianHttpTransaction,
    ): Promise<HttpRequestTemplate> {
      const template: HttpRequestTemplate = await emitter.emitAction(
        'core.request.sample',
        { transaction },
        { strategy: 'first' },
      );

      return origin ? { ...template, origin } : template;
    },
    /**
     * Still applied here, for a request built by some route other than
     * {@link sampleRequest} — a hook that replaced the origin outright, say.
     * With the template already carrying it, this is normally a no-op.
     */
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
