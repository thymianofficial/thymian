import { map, type OperatorFunction } from 'rxjs';

import type { HttpTestCase, HttpTestCaseStep } from '../http-test-case.js';

export function failTestCase<Steps extends HttpTestCaseStep[]>(
  fn: (testCase: HttpTestCase<Steps>) => boolean = () => true
): OperatorFunction<HttpTestCase<Steps>, HttpTestCase<Steps>> {
  return map((testCase) => ({
    ...testCase,
    status: fn(testCase) ? 'failed' : testCase.status,
  }));
}
