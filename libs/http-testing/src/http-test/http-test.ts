import type { ThymianHttpRequest, ThymianHttpResponse } from '@thymian/core';

import type { AssertionFn } from '../assertions/assertion.js';
import type { HttpRequestTemplate } from '../rxjs/http-request-template.js';
import type { HttpResponse } from '../rxjs/http-response.js';
import type { KeysWithStringOrNumberValue } from '../utils.js';
import type { HttpTestContext, HttpTestContextFn } from './context.js';
import type { OverrideHttpRequest } from './override.js';
import type { TransactionsFilterFn } from './transaction-filter.js';

export type HttpTestTransaction = {
  thymianReq?: ThymianHttpRequest;
  reqId?: string;
  thymianRes?: ThymianHttpResponse;
  resId?: string;
  req: HttpRequestTemplate;
  res: HttpResponse;
};

export interface HttpTestSuite {
  name: string;
  context: HttpTestContext;
  contextFns: HttpTestContextFn[];
  tests: HttpTest[];
}

export interface HttpTest {
  name: string;
  description?: string;
  contextFns: HttpTestContextFn[];
  results: TestResult[];
  status: HttpTestStatus;
  type: 'single' | 'sequence' | 'parallel';
}

export interface SingleHttpTest extends HttpTest {
  type: 'single';
  transactionFilter: TransactionsFilterFn<any>;
  groupHttpRequestsBy?: KeysWithStringOrNumberValue<ThymianHttpRequest>[];
  mapGroupsToHttpRequests?: (
    keys: Record<string, string | number>,
    requests: ThymianHttpRequest[]
  ) => HttpRequestTemplate;
  override: OverrideHttpRequest[];
  assertions: AssertionFn<any>[];
}

export interface SequenceHttpTest extends HttpTest {
  type: 'sequence';
  steps: SingleHttpTest[];
  assertions: AssertionFn<any>[];
}

export interface SingleHttpTestResult {
  testName: string;
  transaction: HttpTestTransaction;
  duration: number;
  status: HttpTestStatus;
  results: TestResult[];
}

export type TestResult = {
  message: string;
  type: 'error' | 'assertion-failure' | 'assertion-success' | 'info';
};

export type HttpTestStatus = 'pass' | 'skip' | 'fail' | 'running' | 'pending';
