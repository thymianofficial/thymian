import type { HttpResponse } from '@thymian/core';
import { identity, type OperatorFunction } from 'rxjs';

import type {
  HttpTestCase,
  HttpTestCaseResult,
  HttpTestCaseStep,
} from '../http-test-case.js';

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
