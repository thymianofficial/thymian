import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type {
  HttpTestCase,
  HttpTestCaseStep,
} from '../http-test/http-test-case.js';
import type { PipelineItem } from '../http-test/http-test-pipeline.js';

export function skipTestCase<Steps extends HttpTestCaseStep[]>(
  fn: (testCase: HttpTestCase<Steps>) => boolean = () => true
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return map(({ current, ctx }) => ({
    current: {
      ...current,
      status: fn(current) ? 'skipped' : current.status,
    },
    ctx,
  }));
}
