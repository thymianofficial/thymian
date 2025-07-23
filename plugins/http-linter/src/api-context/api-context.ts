import { type PartialBy, type ReportFn, ThymianFormat } from '@thymian/core';
import type { HttpFilterExpression } from '@thymian/http-filter';

import type { RuleFnResult } from '../rule/rule-fn.js';
import type { RuleViolation } from '../rule/rule-violation.js';

export type FilterFn<Args extends unknown[]> = (...args: Args) => boolean;

export type ValidationFn<
  Args extends unknown[],
  R = PartialBy<RuleViolation, 'location'> | boolean | undefined
> = (...args: Args) => R;

export type CommonHttpRequest = {
  id: string;
  origin: string;
  path: string;
  method: string;
  headers: string[];
  queryParameters: string[];
  cookies: string[];
  mediaType: string;
  body: boolean;
};

export type CommonHttpResponse = {
  id: string;
  statusCode: number;
  mediaType: string;
  headers: string[];
  body: boolean;
  trailers: string[];
};

export abstract class ApiContext {
  constructor(
    readonly format: ThymianFormat,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    protected readonly report: ReportFn = () => {}
  ) {}

  abstract validateCommonHttpTransactions(
    filterFn: HttpFilterExpression,
    validationFn:
      | ValidationFn<[CommonHttpRequest, CommonHttpResponse, string]>
      | HttpFilterExpression
  ): Promise<RuleFnResult> | RuleFnResult;

  abstract validateGroupedCommonHttpTransactions(
    filterFn: HttpFilterExpression,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse][]],
      RuleViolation | undefined
    >
  ): Promise<RuleFnResult> | RuleFnResult;
}

//export interface LiveApiContext extends ApiContext {}
export abstract class LiveApiContext extends ApiContext {}
