import type {
  ThymianFormat,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '@thymian/core';

import type { AssertionFn } from '../assertions/assertion.js';
import type { HttpRequest } from '../request.js';
import type { HttpResponse } from '../response.js';
import type { HttpTestContext, HttpTestContextFn } from './context.js';
import type { OverrideHttpRequest } from './override.js';

export type HttpTestCaseGenerator<
  Context extends HttpTestContext = HttpTestContext
> = (
  format: ThymianFormat,
  context: Context
) => Omit<HttpTestCase, 'response'>[];

export type HttpTestTransaction = {
  req: ThymianHttpRequest;
  redId: string;
  res: ThymianHttpResponse;
  resId: string;
  actualReq: HttpRequest;
  actualResponse: HttpResponse;
  format: ThymianFormat;
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
  context: HttpTestContext;
  contextFns: HttpTestContextFn[];
  results: TestResult[];
  status: HttpTestStatus;
  type: 'single' | 'sequence' | 'parallel';
}

export interface SingleHttpTest extends HttpTest {
  type: 'single';
  generate: HttpTestCaseGenerator;
  override: OverrideHttpRequest[];
  assertions: AssertionFn<{
    testCase: HttpTestCase;
    test: SingleHttpTest;
    format: ThymianFormat;
  }>[];
}

export interface SequenceHttpTest extends HttpTest {
  type: 'sequence';
  steps: SingleHttpTest[];
  assertions: AssertionFn<HttpTestTransaction[]>[];
}

export interface HttpTestCase {
  reqId: string;
  resId: string;
  request: HttpRequest;
  response: HttpResponse;
}

export interface HttpTestResult {
  duration: number;
  status: HttpTestStatus;
  results: TestResult[];
}

export type TestResult = {
  message: string;
  type: 'error' | 'assertion-failure' | 'assertion-success' | 'info';
};

export type HttpTestStatus = 'pass' | 'skip' | 'fail' | 'running' | 'pending';
