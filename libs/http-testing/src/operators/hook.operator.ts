import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type { HttpTestCase, HttpTestCaseStep } from '../http-test-case.js';

export function hook<Steps extends HttpTestCaseStep[]>(
  name: string
): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return mergeMap(async ({ curr, ctx }) => ({
    curr: await ctx.runHook(name, curr),
    ctx,
  }));
}
