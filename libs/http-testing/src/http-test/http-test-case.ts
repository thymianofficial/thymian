import type {
  HttpRequest,
  HttpRequestTemplate,
  HttpResponse,
  ThymianHttpTransaction,
} from '@thymian/core';

import type { HttpTestCaseResult } from './http-test-case-result.js';

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

export type HttpTestCaseStepTransaction = {
  requestTemplate: HttpRequestTemplate;
  request?: HttpRequest;
  response?: HttpResponse;
  source?: ThymianHttpTransaction;
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
  name: string;
  readonly steps: Steps;
  readonly results: HttpTestCaseResult[];
};
