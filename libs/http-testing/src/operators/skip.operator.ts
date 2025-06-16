import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type { HttpTestCase, HttpTestCaseStep } from '../http-test-case.js';

export function skip<Steps extends HttpTestCaseStep[]>(
  fn: (testCase: HttpTestCase<Steps>) => boolean = () => true
): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return map(({ curr, ctx }) => ({
    curr: {
      ...curr,
      status: fn(curr) ? 'skipped' : curr.status,
    },
    ctx,
  }));
}
