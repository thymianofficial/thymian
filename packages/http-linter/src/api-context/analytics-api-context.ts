import {
  type HttpRequest,
  type HttpResponse,
  httpTransactionToLabel,
  type Logger,
  matchesOrigin,
  or,
  type ReportFn,
  ThymianFormat,
} from '@thymian/core';
import { and, type HttpFilterExpression, not } from '@thymian/core';
import type { RuleFnResult } from 'src/rule/rule-fn.js';
import type { RuleViolation } from 'src/rule/rule-violation.js';

import type { HttpTransactionRepository } from '../db/http-transaction-repository.js';
import type { HttpParticipantRole } from '../rule/rule-meta.js';
import type { RuleViolationLocation } from '../rule/rule-violation.js';
import type { CapturedTrace, CapturedTransaction } from '../types.js';
import { type ValidationFn } from './api-context.js';
import type { CommonHttpRequest, CommonHttpResponse } from './common-types.js';
import { LiveApiContext } from './live-api-context.js';
import {
  httpRequestToCommonHttpRequest,
  httpResponseToCommonHttpResponse,
} from './utils/http-to-common.js';
import { capturedTraceToString } from './utils/trace-to-string.js';

export class AnalyticsApiContext extends LiveApiContext {
  private readonly roles?: HttpParticipantRole[];

  constructor(
    readonly repository: HttpTransactionRepository,
    logger: Logger,
    format: ThymianFormat,
    reportFn?: ReportFn,
    roles?: HttpParticipantRole[],
    skippedOrigins?: string[],
  ) {
    super(format, logger, reportFn, skippedOrigins);

    if (roles) {
      this.roles = roles.flatMap((role) =>
        role === 'intermediary'
          ? ['proxy', 'tunnel', 'gateway', 'intermediary']
          : role,
      );
    }
  }

  private addOriginsToFilter(
    filter: HttpFilterExpression,
  ): HttpFilterExpression {
    return this.skippedOrigins.length === 0
      ? filter
      : and(
          filter,
          not(
            or(...this.skippedOrigins.map((origin) => matchesOrigin(origin))),
          ),
        );
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

    finalFilter = this.addOriginsToFilter(finalFilter);

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

    return results.concat(this.violations);
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
    const finalFilter = this.addOriginsToFilter(filter);

    const groups = this.repository.readAndGroupTransactionsByHttpFilter(
      finalFilter,
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
      | ValidationFn<[HttpRequest, HttpResponse, string]>
      | HttpFilterExpression = filter,
  ): Promise<RuleFnResult> | RuleFnResult {
    let finalFilter!: HttpFilterExpression;
    let validateFn!: ValidationFn<[HttpRequest, HttpResponse, string]>;

    if (typeof validation === 'function') {
      finalFilter = filter;
      validateFn = validation;
    } else {
      finalFilter = and(filter, validation);
      validateFn = () => true;
    }

    finalFilter = this.addOriginsToFilter(finalFilter);

    const results: RuleFnResult = [];

    for (const {
      request,
      response,
    } of this.repository.readTransactionsByHttpFilter(
      finalFilter,
      this.roles,
    )) {
      const location = httpTransactionToLabel(request.data, response.data);

      const violation = validateFn(request.data, response.data, location);

      if (violation) {
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

    return results.concat(this.violations);
  }

  validateCapturedHttpTransactions(
    filter: HttpFilterExpression,
    validate: ValidationFn<[CapturedTransaction, string]>,
  ): Promise<RuleFnResult> | RuleFnResult {
    const finalFilter = this.addOriginsToFilter(filter);

    const results: RuleFnResult = [];

    for (const transaction of this.repository.readTransactionsByHttpFilter(
      finalFilter,
      this.roles,
    )) {
      const location = httpTransactionToLabel(
        transaction.request.data,
        transaction.response.data,
      );

      const violation = validate(transaction, location);

      if (violation) {
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

    return results.concat(this.violations);
  }

  validateCapturedHttpTraces(
    validate: ValidationFn<[CapturedTrace, string]>,
  ): RuleFnResult {
    const results: RuleFnResult = [];

    for (const trace of this.repository.readAllHttpTraces()) {
      const location = capturedTraceToString(trace);

      const violation = validate(trace, location);

      if (violation) {
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

    return results.concat(this.violations);
  }
}
