import { AssertionError } from 'node:assert';

import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type { HttpTestCase, HttpTestCaseStep } from '../http-test-case.js';

export function expect<Steps extends HttpTestCaseStep[]>(
  fn: (testInstance: HttpTestInstance<HttpTestCase<Steps>>) => void
): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return map((testInstance) => {
    try {
      fn(testInstance);
    } catch (e) {
      if (e instanceof AssertionError) {
        return testInstance.ctx.fail(testInstance.curr, e.message);
      } else {
        throw e;
      }
    }

    return testInstance;
  });
}
