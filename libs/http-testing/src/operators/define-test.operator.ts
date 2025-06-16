import { ThymianFormat } from '@thymian/core';
import { identity, type OperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type {
  HttpTestCase,
  SingleHttpTestCaseStep,
} from '../http-test-case.js';
import { authorizeRequests } from './authorize-requests.operator.js';
import {
  forHttpTransactions,
  type RequestFilter,
  type ResponseFilter,
} from './for-http-transactions.operator.js';
import { generateRequests } from './generate-requests.operator.js';
import { toTestCases } from './to-test-cases.operator.js';
import { validateResponses } from './validate-responses.operator.js';
import { runRequests } from './run-requests.operator.js';

export type DefineTestOptions = {
  reqFilter: RequestFilter;
  resFilter: ResponseFilter;
  authorize: boolean;
  validate: boolean;
};

export function defineTest(
  options: Partial<DefineTestOptions> = {}
): OperatorFunction<
  HttpTestInstance<ThymianFormat>,
  HttpTestInstance<HttpTestCase<[SingleHttpTestCaseStep]>>
> {
  const opts: DefineTestOptions = {
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
      opts.authorize ? authorizeRequests() : identity,
      runRequests(),
      opts.validate ? validateResponses() : identity
    );
}
