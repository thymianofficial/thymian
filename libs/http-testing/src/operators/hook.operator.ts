import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import type {
  HttpTestCase,
  HttpTestCaseStep,
} from '../http-test/http-test-case.js';
import type { PipelineItem } from '../http-test/http-test-pipeline.js';

export function hook<Steps extends HttpTestCaseStep[]>(
  name: string
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return mergeMap(async ({ current, ctx }) => ({
    current: await ctx.runHook(name, current),
    ctx,
  }));
}
