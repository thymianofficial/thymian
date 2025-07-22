import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpRequestTemplate } from '../http-request-template.js';
import type {
  HttpTestCase,
  HttpTestCaseStep,
} from '../http-test/http-test-case.js';
import type { PipelineItem } from '../http-test/http-test-pipeline.js';

export function overrideRequestWithPrevious<
  Steps extends HttpTestCaseStep[],
  Previous extends HttpTestCaseStep,
  Current extends HttpTestCaseStep
>(
  fn: (
    requestTemplate: HttpRequestTemplate,
    previous: Previous
  ) => HttpRequestTemplate
): MonoTypeOperatorFunction<
  PipelineItem<HttpTestCase<[...Steps, Previous, Current]>>
> {
  return map(({ current, ctx }) => {
    const previous = current.steps.at(-2) as Previous | undefined;

    if (typeof previous === 'undefined') {
      throw new Error('Previous http test case step must be defined.');
    }

    const currentStep = current.steps.at(-1) as Current | undefined;

    if (typeof currentStep === 'undefined') {
      throw new Error('Current http test case step must be defined.');
    }

    currentStep.transactions = currentStep.transactions.map((transaction) => ({
      ...transaction,
      requestTemplate: fn(transaction.requestTemplate, previous),
    }));

    return { current, ctx };
  });
}
