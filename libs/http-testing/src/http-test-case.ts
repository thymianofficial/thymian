import type { ThymianHttpRequest, ThymianHttpResponse } from '@thymian/core';

import type { HttpRequest } from './http-request.js';
import type { HttpRequestTemplate } from './http-request-template.js';
import type { HttpResponse } from './http-response.js';

export function isSingleHttpTestCaseStep(
  step?: HttpTestCaseStep
): step is SingleHttpTestCaseStep {
  return step?.type === 'single';
}

export function isGroupedHttpTestCaseStep(
  step?: HttpTestCaseStep
): step is GroupedHttpTestCaseStep {
  return step?.type === 'grouped';
}

export function isCustomHttpTestCaseStep(
  step?: HttpTestCaseStep
): step is CustomHttpTestCaseStep {
  return step?.type === 'custom';
}

export function isSkippedTestCase<Steps extends HttpTestCaseStep[]>(
  testCase: HttpTestCase<Steps>
): testCase is HttpTestCase<Steps> & { staus: 'skipped' } {
  return testCase.status === 'skipped';
}

export function isFailedTestCase<Steps extends HttpTestCaseStep[]>(
  testCase: HttpTestCase<Steps>
): testCase is HttpTestCase<Steps> & { staus: 'failed' } {
  return testCase.status === 'failed';
}

export type HttpTestCaseResult = {
  message: string;
  type: 'error' | 'assertion-failure' | 'assertion-success' | 'info';
};

export type ThymianHttpTransaction = {
  thymianReq: ThymianHttpRequest;
  thymianReqId: string;
  thymianRes: ThymianHttpResponse;
  thymianResId: string;
  transactionId: string;
};

export interface GroupedHttpTestCaseStep
  extends HttpTestCaseStep<{
    key: string;
    transactions: ThymianHttpTransaction[];
  }> {
  type: 'grouped';
}

export interface SingleHttpTestCaseStep
  extends HttpTestCaseStep<ThymianHttpTransaction> {
  type: 'single';
}

export interface CustomHttpTestCaseStep<Source = unknown>
  extends HttpTestCaseStep<Source> {
  type: 'custom';
}

export type HttpTestCaseStepTransaction = {
  requestTemplate: HttpRequestTemplate;
  request?: HttpRequest;
  response?: HttpResponse;
  source?: ThymianHttpTransaction;
};

export interface HttpTestCaseStep<Source = unknown> {
  type: 'single' | 'grouped' | 'custom';
  source: Source;
  transactions: HttpTestCaseStepTransaction[];
}

export type HttpTestCase<
  Steps extends HttpTestCaseStep[] = HttpTestCaseStep[]
> = {
  duration: number;
  status: 'running' | 'skipped' | 'failed' | 'passed';
  reason?: string;
  readonly steps: Steps;
  readonly results: HttpTestCaseResult[];
};
