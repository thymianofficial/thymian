import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type {
  HttpTestCase,
  HttpTestCaseStep,
} from '../http-test/http-test-case.js';
import type { PipelineItem } from '../http-test/http-test-pipeline.js';
import { isFailedTestCase, isSkippedTestCase } from '../http-test/index.js';

export function overrideHeaders<Steps extends HttpTestCaseStep[]>(
  fn: (
    headers: Record<string, unknown>,
    testCase: HttpTestCase<Steps>
  ) => Record<string, unknown>
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return map(({ current, ctx }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return { current, ctx };
    }

    const currentStep = current.steps.at(-1);

    if (typeof currentStep === 'undefined') {
      throw new Error('Current http test case step must be defined.');
    }

    for (const transaction of currentStep.transactions) {
      transaction.requestTemplate.headers = fn(
        transaction.requestTemplate.headers,
        current
      );
    }

    return { current, ctx };
  });
}
