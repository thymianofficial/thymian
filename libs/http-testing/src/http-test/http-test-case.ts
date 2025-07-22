import type {
  HttpRequest,
  HttpResponse,
  ThymianHttpTransaction,
} from '@thymian/core';

import type { HttpRequestTemplate } from './http-request-template.js';

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

export interface GroupedHttpTestCaseStep<
  Transactions extends HttpTestCaseStepTransaction[] = HttpTestCaseStepTransaction[]
> extends HttpTestCaseStep<
    {
      key: string;
      transactions: ThymianHttpTransaction[];
    },
    Transactions
  > {
  type: 'grouped';
}

export interface SingleHttpTestCaseStep<
  Transactions extends HttpTestCaseStepTransaction[] = HttpTestCaseStepTransaction[]
> extends HttpTestCaseStep<ThymianHttpTransaction, Transactions> {
  type: 'single';
}

export interface CustomHttpTestCaseStep<Source = unknown>
  extends HttpTestCaseStep<Source> {
  type: 'custom';
}

export type HttpTestCaseStepTransaction<
  Source extends ThymianHttpTransaction | undefined =
    | ThymianHttpTransaction
    | undefined,
  Request extends HttpRequest | undefined = HttpRequest | undefined,
  Response extends HttpResponse | undefined = HttpResponse | undefined
> = {
  requestTemplate: HttpRequestTemplate;
  request: Request;
  response: Response;
  source: Source;
};

export interface HttpTestCaseStep<
  Source = unknown,
  Transactions extends HttpTestCaseStepTransaction[] = HttpTestCaseStepTransaction[]
> {
  type: 'single' | 'grouped' | 'custom';
  source: Source;
  transactions: Transactions;
}

export type HttpTestCaseStatus = 'running' | 'skipped' | 'failed' | 'passed';

export type HttpTestCase<
  Steps extends HttpTestCaseStep[] = HttpTestCaseStep[]
> = {
  start: number;
  end?: number;
  status: HttpTestCaseStatus;
  reason?: string;
  name?: string;
  readonly steps: Steps;
  readonly results: HttpTestCaseResult[];
};
