import {
  type AnalyzeContext,
  and,
  type CapturedTrace,
  capturedTraceToString,
  type CapturedTransaction,
  type CommonHttpRequest,
  type CommonHttpResponse,
  createRegExpFromOriginWildcard,
  type HttpFilterExpression,
  type HttpParticipantRole,
  type HttpRequest,
  httpRequestToCommonHttpRequest,
  type HttpResponse,
  httpResponseToCommonHttpResponse,
  httpTransactionToLabel,
  type Logger,
  matchesOrigin,
  not,
  or,
  type ReportFn,
  type RuleFnResult,
  type RuleViolation,
  type RuleViolationLocation,
  ThymianFormat,
  thymianRequestToOrigin,
  type ValidationFn,
} from '@thymian/core';

import type { HttpTransactionRepository } from './db/http-transaction-repository.js';

export class AnalyticsApiContext implements AnalyzeContext {
  readonly format: ThymianFormat;
  readonly report: ReportFn;
  private readonly violations: RuleViolation[] = [];
  private readonly roles?: HttpParticipantRole[];
  private readonly skippedOrigins: string[];

  constructor(
    readonly repository: HttpTransactionRepository,
    private readonly logger: Logger,
    format: ThymianFormat,
    reportFn?: ReportFn,
    roles?: HttpParticipantRole[],
    skippedOrigins?: string[],
  ) {
    this.report = reportFn ?? (() => undefined);
    this.skippedOrigins = skippedOrigins ?? [];

    if (this.skippedOrigins.length === 0) {
      this.format = format;
    } else {
      const regExps = this.skippedOrigins.map(createRegExpFromOriginWildcard);

      this.format = format.filter(
        ({ thymianReq }) =>
          !regExps.some((regExp) =>
            regExp.test(thymianRequestToOrigin(thymianReq)),
          ),
      );
    }

    if (roles) {
      this.roles = roles.flatMap((role) =>
        role === 'intermediary'
          ? (['proxy', 'tunnel', 'gateway', 'intermediary'] as const)
          : role,
      );
    }
  }

  reportViolation(violation: RuleViolation): void {
    this.violations.push(violation);
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

  validateCommonHttpTransactions(
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

  validateGroupedCommonHttpTransactions(
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

  validateHttpTransactions(
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
