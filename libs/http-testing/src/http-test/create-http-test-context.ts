import type { HttpTestCase, HttpTestCaseStep } from './http-test-case.js';
import type {
  HttpTestContext,
  HttpTestContextLocals,
} from './http-test-context.js';
import type { PipelineItem } from './http-test-pipeline.js';

export function createHttpTestContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals
>(
  context: Omit<HttpTestContext<Locals>, 'skip' | 'fail'>
): HttpTestContext<Locals> {
  return {
    ...context,
    skip<Steps extends HttpTestCaseStep[]>(
      testCase: HttpTestCase<Steps>,
      reason?: string
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
      reason?: string
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
