import { AssertionError } from 'node:assert';

import { map, type MonoTypeOperatorFunction } from 'rxjs';

import {
  type HttpTestCase,
  type HttpTestCaseStep,
  isFailedTestCase,
  isSkippedTestCase,
  type PipelineItem,
} from '../http-test/index.js';

export function expect<Steps extends HttpTestCaseStep[]>(
  fn: (testInstance: PipelineItem<HttpTestCase<Steps>>) => void
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return map((item) => {
    if (isSkippedTestCase(item.current) || isFailedTestCase(item.current)) {
      return item;
    }

    try {
      fn(item);
    } catch (e) {
      if (e instanceof AssertionError) {
        item.current.results.push({
          type: 'assertion-failure',
          message: e.message,
          timestamp: Date.now(),
          assertion: e.operator,
          expected: e.expected,
          actual: e.actual,
        });

        return item.ctx.fail(item.current, e.message);
      } else {
        throw e;
      }
    }

    return item;
  });
}
