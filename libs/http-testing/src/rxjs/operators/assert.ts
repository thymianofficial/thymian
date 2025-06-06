import { identity, type OperatorFunction } from 'rxjs';

import type {
  HttpTestCase,
  HttpTestCaseResult,
  HttpTestCaseStep,
} from '../http-test-case.js';
import type { HttpResponse } from '../http-response.js';

export function assertStep<Step extends HttpTestCaseStep[]>(
  fn: (step: Step) => HttpTestCaseResult[]
): OperatorFunction<HttpTestCase<Step>, HttpTestCase<Step>> {
  return identity;
}

export function assertResponses<Step extends HttpTestCaseStep[]>(
  fn: (response: HttpResponse) => unknown
): OperatorFunction<HttpTestCase<Step>, HttpTestCase<Step>> {
  return identity;
}
