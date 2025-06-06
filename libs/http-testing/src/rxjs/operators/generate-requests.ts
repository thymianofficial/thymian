import { map, type OperatorFunction } from 'rxjs';

import type {
  GroupedHttpTestCaseStep,
  HttpTestCase,
  SingleHttpTestCaseStep,
} from '../http-test-case.js';

export function generateRequestsForTestCases<
  Step extends SingleHttpTestCaseStep | GroupedHttpTestCaseStep
>(): OperatorFunction<HttpTestCase<[Step]>, HttpTestCase<[Step]>> {
  return map((testCase) => testCase);
}
