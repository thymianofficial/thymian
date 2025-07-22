import { type HttpRequest, isRecord } from '@thymian/core';

import type {
  HttpTestCase,
  HttpTestCaseStep,
  HttpTestCaseStepTransaction,
  SingleHttpTestCaseStep,
} from '../http-test/http-test-case.js';

export function hasOwnProperty<
  T extends Record<PropertyKey, unknown>,
  K extends PropertyKey
>(obj: T, key: K): obj is T & Record<K, unknown> {
  return Object.hasOwn(obj, key);
}

export function hasThymianReqId(
  value: unknown
): value is Record<PropertyKey, unknown> & { thymianReqId: string } {
  return isRecord(value) && 'thymianReqId' in value;
}

export function hasThymianResId(
  value: unknown
): value is Record<PropertyKey, unknown> & { thymianResId: string } {
  return isRecord(value) && 'thymianResId' in value;
}

export function previousStep<Steps extends HttpTestCaseStep[]>(
  testCase: HttpTestCase<Steps>
): Steps extends [...HttpTestCaseStep[], infer Previous, HttpTestCaseStep]
  ? Previous
  : undefined {
  // TODO
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return testCase.steps.at(-2);
}
