import {
  type HttpFilterExpression,
  thymianRequestToOrigin,
} from '@thymian/core';
import {
  type Logger,
  type PartialBy,
  type ReportFn,
  ThymianFormat,
} from '@thymian/core';

import type { RuleFnResult } from '../rule/rule-fn.js';
import type {
  RuleViolation,
  RuleViolationLocation,
} from '../rule/rule-violation.js';
import { createRegExpFromOriginWildcard } from '../utils.js';
import type { CommonHttpRequest, CommonHttpResponse } from './common-types.js';

export type ValidationFn<
  Args extends unknown[],
  R = PartialBy<RuleViolation, 'location'> | boolean | undefined,
> = (...args: Args) => R;

export abstract class ApiContext {
  readonly format: ThymianFormat;

  constructor(
    format: ThymianFormat,
    protected readonly logger: Logger,
    protected readonly report: ReportFn = () => undefined,
    protected readonly skippedOrigins: string[] = [],
  ) {
    if (skippedOrigins.length === 0) {
      this.format = format;
    } else {
      const regExps = skippedOrigins.map(createRegExpFromOriginWildcard);

      this.format = format.filter(
        ({ thymianReq }) =>
          !regExps.some((regExp) =>
            regExp.test(thymianRequestToOrigin(thymianReq)),
          ),
      );
    }
  }

  abstract validateCommonHttpTransactions(
    filter: HttpFilterExpression,
    validationFn?:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression,
  ): Promise<RuleFnResult> | RuleFnResult;

  abstract validateGroupedCommonHttpTransactions(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    validationFn: ValidationFn<
      [
        string,
        [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][],
      ],
      RuleViolation | undefined
    >,
  ): Promise<RuleFnResult> | RuleFnResult;
}
