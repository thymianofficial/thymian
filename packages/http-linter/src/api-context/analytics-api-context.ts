import {
  type HttpRequest,
  type HttpResponse,
  httpTransactionToLabel,
  type Logger,
  type ReportFn,
  ThymianFormat,
} from '@thymian/core';
import { and, type HttpFilterExpression } from '@thymian/core';
import type { RuleFnResult } from 'src/rule/rule-fn.js';
import type { RuleViolation } from 'src/rule/rule-violation.js';

import type { HttpTransactionRepository } from '../db/http-transaction-repository.js';
import type { HttpParticipantRole } from '../rule/rule-meta.js';
import type { RuleViolationLocation } from '../rule/rule-violation.js';
import { type ValidationFn } from './api-context.js';
import type { CommonHttpRequest, CommonHttpResponse } from './common-types.js';
import { LiveApiContext } from './live-api-context.js';
import {
  httpRequestToCommonHttpRequest,
  httpResponseToCommonHttpResponse,
} from './utils/http-to-common.js';

export class AnalyticsApiContext extends LiveApiContext {
  constructor(
    readonly repository: HttpTransactionRepository,
    logger: Logger,
    format: ThymianFormat,
    reportFn?: ReportFn,
    private readonly roles?: HttpParticipantRole[],
  ) {
    super(format, logger, reportFn);
  }

  override validateCommonHttpTransactions(
    filter: HttpFilterExpression,
    validate:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression = filter,
  ): Promise<RuleFnResult> | RuleFnResult {
    let finalFilter!: HttpFilterExpression;
    let validateFn!: ValidationFn<
      [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
    >;

    if (typeof validate === 'function') {
      finalFilter = filter;
      validateFn = validate;
    } else {
      finalFilter = and(filter, validate);
      validateFn = () => true;
    }

    const results: RuleFnResult = [];

    for (const {
      request,
      response,
    } of this.repository.readTransactionsByHttpFilter(
      finalFilter,
      this.roles,
    )) {
      const violation = validateFn(
        httpRequestToCommonHttpRequest(request.data),
        httpResponseToCommonHttpResponse(response.data),
        httpTransactionToLabel(request.data, response.data),
      );

      if (violation) {
        const location = httpTransactionToLabel(request.data, response.data);

        if (violation === true) {
          results.push({
            location,
          });
        } else {
          results.push({
            location,
            ...violation,
          });
        }
      }
    }

    return results;
  }

  override validateGroupedCommonHttpTransactions(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    validationFn: ValidationFn<
      [
        string,
        [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][],
      ],
      RuleViolation | undefined
    >,
  ): Promise<RuleFnResult> | RuleFnResult {
    const results: RuleFnResult = [];

    const groups = this.repository.readAndGroupTransactionsByHttpFilter(
      filter,
      groupBy,
      this.roles,
    );

    for (const [key, transactions] of groups) {
      const violation = validationFn(
        key,
        transactions.map((t) => [
          httpRequestToCommonHttpRequest(t.request.data),
          httpResponseToCommonHttpResponse(t.response.data),
          httpTransactionToLabel(t.request.data, t.response.data),
        ]),
      );

      if (violation) {
        results.push(violation);
      }
    }

    return results;
  }

  override validateHttpTransactions(
    filter: HttpFilterExpression,
    validation:
      | ValidationFn<[HttpRequest, HttpResponse]>
      | HttpFilterExpression = filter,
  ): Promise<RuleFnResult> | RuleFnResult {
    let finalFilter!: HttpFilterExpression;
    let validateFn!: ValidationFn<[HttpRequest, HttpResponse]>;

    if (typeof validation === 'function') {
      finalFilter = filter;
      validateFn = validation;
    } else {
      finalFilter = and(filter, validation);
      validateFn = () => true;
    }

    const results: RuleFnResult = [];

    for (const {
      request,
      response,
    } of this.repository.readTransactionsByHttpFilter(
      finalFilter,
      this.roles,
    )) {
      const violation = validateFn(request.data, response.data);

      if (violation) {
        const location = httpTransactionToLabel(request.data, response.data);

        if (violation === true) {
          results.push({
            location,
          });
        } else {
          results.push({
            location,
            ...violation,
          });
        }
      }
    }

    return results;
  }
}
