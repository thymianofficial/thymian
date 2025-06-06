import { map, mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTest } from '../http-test.js';
import type { HttpTestCase, HttpTestCaseStep } from '../http-test-case.js';

export function authorizeRequests<
  Steps extends HttpTestCaseStep[]
>(): MonoTypeOperatorFunction<HttpTest<HttpTestCase<Steps>>> {
  return map(({ curr, ctx }) => ({ curr, ctx }));
}
