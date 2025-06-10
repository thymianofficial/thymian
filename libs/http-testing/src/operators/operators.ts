import { type Parameter, ThymianSchema } from '@thymian/core';
import { identity, mergeMap, type OperatorFunction } from 'rxjs';

import type { HttpRequestTemplate } from '../http-request-template.js';
import type { HttpTestCase, HttpTestCaseStep } from '../http-test-case.js';

export type Operators = {
  runHook<Input>(hook: string): OperatorFunction<Input, Input>;

  runRequests<Steps extends HttpTestCaseStep[]>(): OperatorFunction<
    HttpTestCase<Steps>,
    HttpTestCase<Steps>
  >;

  runRequestsParallel<Steps extends HttpTestCaseStep[]>(): OperatorFunction<
    HttpTestCase<Steps>,
    HttpTestCase<Steps>
  >;

  generateRequests<Steps extends HttpTestCaseStep[]>(
    amount?: number
  ): OperatorFunction<HttpTestCase<Steps>, HttpTestCase<Steps>>;

  generateContent(
    schema: ThymianSchema,
    contentType?: string
  ): Promise<unknown>;

  generateParameter(parameter: Parameter): Promise<unknown>;

  generateRequestFor(reqId: string): Promise<HttpRequestTemplate>;

  authorizeRequests<Steps extends HttpTestCaseStep[]>(): OperatorFunction<
    HttpTestCase<Steps>,
    HttpTestCase<Steps>
  >;
};
