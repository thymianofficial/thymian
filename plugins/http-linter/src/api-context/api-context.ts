import { type PartialBy, ThymianFormat } from '@thymian/core';

import type { RuleFnResult } from '../rule/rule-fn.js';
import type {
  RuleViolation,
  RuleViolationLocation,
} from '../rule/rule-violation.js';

export type FilterFn<T1, T2> = (x: T1, y: T2) => boolean;

export type ValidationFn<
  T1,
  T2,
  R = PartialBy<RuleViolation, 'location'> | boolean
> = (x: T1, y: T2) => R | undefined;

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
  constructor(readonly format: ThymianFormat) {}

  abstract validateCommonHttpTransactions(
    filterFn: FilterFn<CommonHttpRequest, CommonHttpResponse>,
    validationFn: ValidationFn<CommonHttpRequest, CommonHttpResponse>
  ): Promise<RuleFnResult> | RuleFnResult;

  abstract validateGroupedCommonHttpTransactions(
    filterFn: FilterFn<CommonHttpRequest, CommonHttpResponse>,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      string,
      [CommonHttpRequest, CommonHttpResponse][],
      RuleViolation
    >
  ): Promise<RuleFnResult> | RuleFnResult;

  equalsIgnoreCase(a: string, ...b: string[]): boolean {
    return b.some(
      (str) => a.localeCompare(str, undefined, { sensitivity: 'accent' }) === 0
    );
  }
}

//export interface LiveApiContext extends ApiContext {}
export abstract class LiveApiContext extends ApiContext {}
