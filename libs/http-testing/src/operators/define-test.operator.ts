import { ThymianFormat } from '@thymian/core';
import { identity, type OperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type {
  HttpTestCase,
  SingleHttpTestCaseStep,
} from '../http-test-case.js';
import {
  forHttpTransactions,
  type RequestFilter,
  type ResponseFilter,
} from './for-http-transactions.operator.js';
import { generateRequests } from './generate-requests.operator.js';
import { runRequests } from './run-requests.operator.js';
import { toTestCases } from './to-test-cases.operator.js';
import { validateResponses } from './validate-responses.operator.js';

export type DefineStepOptions = {
  reqFilter: RequestFilter;
  resFilter: ResponseFilter;
  authorize: boolean;
  validate: boolean;
};

export function defineStep(
  options: Partial<DefineStepOptions> = {}
): OperatorFunction<
  HttpTestInstance<ThymianFormat>,
  HttpTestInstance<HttpTestCase<[SingleHttpTestCaseStep]>>
> {
  const opts: DefineStepOptions = {
    reqFilter: {},
    resFilter: {},
    authorize: true,
    validate: true,
    ...options,
  };

  return (x) =>
    x.pipe(
      forHttpTransactions(opts.reqFilter, opts.resFilter),
      toTestCases(),
      generateRequests(),
      runRequests(),
      opts.validate ? validateResponses() : identity
    );
}
