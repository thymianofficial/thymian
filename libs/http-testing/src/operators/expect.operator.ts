import { AssertionError } from 'node:assert';

import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type {
  AssertionFailure,
  HttpTestCase,
  HttpTestCaseStep,
  PipelineItem,
} from '../http-test/index.js';

export function expect<Steps extends HttpTestCaseStep[]>(
  fn: (testInstance: PipelineItem<HttpTestCase<Steps>>) => void
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return map((envelope) => {
    try {
      fn(envelope);
    } catch (e) {
      if (e instanceof AssertionError) {
        envelope.current.results.push({
          type: 'assertion-failure',
          message: e.message,
          timestamp: Date.now(),
          assertion: e.operator,
          expected: e.expected,
          actual: e.actual,
        });

        return envelope.ctx.fail(envelope.current, e.message);
      } else {
        throw e;
      }
    }

    return envelope;
  });
}
