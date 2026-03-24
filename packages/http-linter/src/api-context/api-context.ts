import {
  type ApiContext as CoreApiContext,
  type CommonHttpRequest,
  type CommonHttpResponse,
  type HttpFilterExpression,
  type RuleViolation,
  type RuleViolationLocation,
  thymianRequestToOrigin,
  type ValidationFn,
} from '@thymian/core';
import { type Logger, type ReportFn, ThymianFormat } from '@thymian/core';

import type { RuleFnResult } from '../rule/rule-fn.js';
import { createRegExpFromOriginWildcard } from '../utils.js';
export type { ValidationFn } from '@thymian/core';

export abstract class ApiContext implements CoreApiContext {
  readonly format: ThymianFormat;
  protected readonly violations: RuleViolation[] = [];
  readonly report: ReportFn;

  constructor(
    format: ThymianFormat,
    protected readonly logger: Logger,
    report: ReportFn = () => undefined,
    protected readonly skippedOrigins: string[] = [],
  ) {
    this.report = report;

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

  reportViolation(violation: RuleViolation): void {
    this.violations.push(violation);
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
