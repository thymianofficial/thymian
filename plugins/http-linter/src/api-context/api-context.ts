import type { PartialBy } from '@thymian/core';

import type { RuleFnResult } from '../rule/rule-fn.js';
import type { RuleViolation } from '../rule/rule-violation.js';

export type FilterFn<T1, T2, T3> = (x: T1, y: T2, z: T3) => boolean;

export type ValidationFn<T1, T2, Args extends unknown[] = never[]> = (
  x: T1,
  y: T2,
  ...args: Args
) => boolean | undefined | PartialBy<RuleViolation, 'location'>;

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
  abstract validateCommonHttpTransactions(
    filterFn: FilterFn<
      CommonHttpRequest,
      CommonHttpResponse,
      CommonHttpResponse[]
    >,
    validationFn: ValidationFn<CommonHttpRequest, CommonHttpResponse>
  ): Promise<RuleFnResult> | RuleFnResult;

  abstract validateGroupedCommonHttpTransactions(
    filterFn: FilterFn<
      CommonHttpRequest,
      CommonHttpResponse,
      CommonHttpResponse[]
    >,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      string,
      [CommonHttpRequest, CommonHttpResponse][]
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
