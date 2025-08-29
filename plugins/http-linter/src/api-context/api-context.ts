import {
  type Logger,
  type PartialBy,
  type ReportFn,
  ThymianFormat,
} from '@thymian/core';
import type { HttpFilterExpression } from '@thymian/http-filter';

import type { RuleFnResult } from '../rule/rule-fn.js';
import type { RuleViolation } from '../rule/rule-violation.js';
import { thymianToCommonHttpResponse } from './utils.js';

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
    protected readonly logger: Logger,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    protected readonly report: ReportFn = () => {}
  ) {}

  abstract validateCommonHttpTransactions(
    filter: HttpFilterExpression,
    validationFn?:
      | ValidationFn<[CommonHttpRequest, CommonHttpResponse, string]>
      | HttpFilterExpression
  ): Promise<RuleFnResult> | RuleFnResult;

  abstract validateGroupedCommonHttpTransactions(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse][]],
      RuleViolation | undefined
    >
  ): Promise<RuleFnResult> | RuleFnResult;

  protected getCommonHttpResponsesOfRequest(
    reqId: string
  ): CommonHttpResponse[] {
    const responses = this.format.getNeighboursOfType(reqId, 'http-response');

    return responses.map(([id, r]) => thymianToCommonHttpResponse(id, r));
  }
}

export abstract class LiveApiContext extends ApiContext {}
