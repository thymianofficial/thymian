import {
  type AnalyzeContext,
  and,
  type CapturedTrace,
  capturedTraceToString,
  type CapturedTransaction,
  type CommonHttpRequest,
  type CommonHttpResponse,
  type CommonHttpTransactionValidation,
  createRegExpFromOriginWildcard,
  expandHttpParticipantRoles,
  type GroupedCommonHttpTransactionValidation,
  type HttpFilterExpression,
  type HttpParticipantRole,
  httpParticipantRoles,
  type HttpRequest,
  httpRequestToCommonHttpRequest,
  type HttpResponse,
  httpResponseToCommonHttpResponse,
  httpTransactionToLabel,
  type HttpTransactionValidation,
  isHttpValidation,
  type Logger,
  matchesOrigin,
  not,
  or,
  type RuleFnResult,
  type RuleViolationLocation,
  ThymianFormat,
  thymianRequestToOrigin,
  type ValidationFn,
} from '@thymian/core';

import type { HttpTransactionRepository } from './db/http-transaction-repository.js';

export interface AnalyticsApiContextOptions {
  repository: HttpTransactionRepository;
  logger: Logger;
  format: ThymianFormat;
  roles?: HttpParticipantRole[];
  skippedOrigins?: string[];
}

function legacyOptionsToObject(
  repository: HttpTransactionRepository,
  logger: Logger | undefined,
  format: ThymianFormat | undefined,
  reportOrRoles?: (() => void) | HttpParticipantRole[],
  rolesOrSkippedOrigins?: HttpParticipantRole[] | string[],
  legacySkippedOrigins?: string[],
): AnalyticsApiContextOptions {
  if (!logger || !format) {
    throw new TypeError('AnalyticsApiContext requires logger and format.');
  }

  const usesLegacyReportSignature = typeof reportOrRoles === 'function';
  const looksLikeRoleArray =
    Array.isArray(rolesOrSkippedOrigins) &&
    rolesOrSkippedOrigins.every((value) =>
      httpParticipantRoles.includes(value as HttpParticipantRole),
    );
  const roles = Array.isArray(reportOrRoles)
    ? reportOrRoles
    : usesLegacyReportSignature ||
        (reportOrRoles === undefined && looksLikeRoleArray)
      ? (rolesOrSkippedOrigins as HttpParticipantRole[] | undefined)
      : undefined;
  const skippedOrigins =
    usesLegacyReportSignature || looksLikeRoleArray
      ? legacySkippedOrigins
      : (rolesOrSkippedOrigins as string[] | undefined);

  return {
    repository,
    logger,
    format,
    roles,
    skippedOrigins,
  };
}

export class AnalyticsApiContext implements AnalyzeContext {
  readonly repository: HttpTransactionRepository;
  readonly format: ThymianFormat;
  private readonly logger: Logger;
  private readonly roles?: HttpParticipantRole[];
  private readonly skippedOrigins: string[];

  constructor(options: AnalyticsApiContextOptions);
  constructor(
    repository: HttpTransactionRepository,
    logger: Logger,
    format: ThymianFormat,
    reportOrRoles?: (() => void) | HttpParticipantRole[],
    rolesOrSkippedOrigins?: HttpParticipantRole[] | string[],
    legacySkippedOrigins?: string[],
  );
  constructor(
    optionsOrRepository: AnalyticsApiContextOptions | HttpTransactionRepository,
    logger?: Logger,
    format?: ThymianFormat,
    reportOrRoles?: (() => void) | HttpParticipantRole[],
    rolesOrSkippedOrigins?: HttpParticipantRole[] | string[],
    legacySkippedOrigins?: string[],
  ) {
    const options =
      'repository' in optionsOrRepository
        ? optionsOrRepository
        : legacyOptionsToObject(
            optionsOrRepository,
            logger,
            format,
            reportOrRoles,
            rolesOrSkippedOrigins,
            legacySkippedOrigins,
          );

    const {
      repository,
      logger: contextLogger,
      format: contextFormat,
      roles,
      skippedOrigins = [],
    } = options;

    this.repository = repository;
    this.logger = contextLogger;
    this.skippedOrigins = skippedOrigins;

    if (this.skippedOrigins.length === 0) {
      this.format = contextFormat;
    } else {
      const regExps = this.skippedOrigins.map(createRegExpFromOriginWildcard);

      this.format = contextFormat.filter(
        ({ thymianReq }) =>
          !regExps.some((regExp) =>
            regExp.test(thymianRequestToOrigin(thymianReq)),
          ),
      );
    }

    if (roles) {
      this.roles = expandHttpParticipantRoles(roles);
    }
  }

  getRuleExecutionDiagnostics(): undefined {
    return undefined;
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
    validation: CommonHttpTransactionValidation,
  ): RuleFnResult[];
  validateCommonHttpTransactions(
    filter: HttpFilterExpression,
    validate?:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression,
  ): RuleFnResult[];
  validateCommonHttpTransactions(
    filterOrValidation: HttpFilterExpression | CommonHttpTransactionValidation,
    validateArg?:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression,
  ): RuleFnResult[] {
    // Recorded pairs are the observation, so the named form evaluates exactly
    // like the positional one: SQL selects by `appliesTo` before validation.
    const [filter, validate] = isHttpValidation(filterOrValidation)
      ? [filterOrValidation.appliesTo, filterOrValidation.violatedWhen]
      : [filterOrValidation, validateArg ?? filterOrValidation];

    let finalFilter!: HttpFilterExpression;
    let validateFn!: ValidationFn<
      [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
    >;

    if (typeof validate === 'function') {
      finalFilter = filter;
      validateFn = validate;
    } else {
      finalFilter = and(filter, validate);
      validateFn = (req, res, location) => [
        { location, violation: {}, findings: [] },
      ];
    }

    finalFilter = this.addOriginsToFilter(finalFilter);

    const results: RuleFnResult[] = [];

    for (const {
      request,
      response,
    } of this.repository.readTransactionsByHttpFilter(
      finalFilter,
      this.roles,
    )) {
      const location = httpTransactionToLabel(request.data, response.data);
      results.push(
        ...validateFn(
          httpRequestToCommonHttpRequest(request.data),
          httpResponseToCommonHttpResponse(response.data),
          location,
        ),
      );
    }

    return results;
  }

  validateGroupedCommonHttpTransactions(
    validation: GroupedCommonHttpTransactionValidation,
  ): RuleFnResult[];
  validateGroupedCommonHttpTransactions(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): RuleFnResult[];
  validateGroupedCommonHttpTransactions(
    filterOrValidation:
      HttpFilterExpression | GroupedCommonHttpTransactionValidation,
    groupByArg?: HttpFilterExpression,
    validationFnArg?: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): RuleFnResult[] {
    const [filter, groupBy, validationFn] = isHttpValidation(filterOrValidation)
      ? [
          filterOrValidation.appliesTo,
          filterOrValidation.groupBy,
          filterOrValidation.violatedWhen,
        ]
      : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        [filterOrValidation, groupByArg!, validationFnArg!];

    const results: RuleFnResult[] = [];
    const finalFilter = this.addOriginsToFilter(filter);

    const groups = this.repository.readAndGroupTransactionsByHttpFilter(
      finalFilter,
      groupBy,
      this.roles,
    );

    for (const [key, transactions] of groups) {
      results.push(
        ...validationFn(
          key,
          transactions.map((t) => [
            httpRequestToCommonHttpRequest(t.request.data),
            httpResponseToCommonHttpResponse(t.response.data),
            httpTransactionToLabel(t.request.data, t.response.data),
          ]),
        ),
      );
    }

    return results;
  }

  validateHttpTransactions(
    validation: HttpTransactionValidation,
  ): RuleFnResult[];
  validateHttpTransactions(
    filter: HttpFilterExpression,
    validation?:
      | ValidationFn<[HttpRequest, HttpResponse, RuleViolationLocation]>
      | HttpFilterExpression,
  ): RuleFnResult[];
  validateHttpTransactions(
    filterOrValidation: HttpFilterExpression | HttpTransactionValidation,
    validationArg?:
      | ValidationFn<[HttpRequest, HttpResponse, RuleViolationLocation]>
      | HttpFilterExpression,
  ): RuleFnResult[] {
    const [filter, validation] = isHttpValidation(filterOrValidation)
      ? [filterOrValidation.appliesTo, filterOrValidation.violatedWhen]
      : [filterOrValidation, validationArg ?? filterOrValidation];

    let finalFilter!: HttpFilterExpression;
    let validateFn!: ValidationFn<
      [HttpRequest, HttpResponse, RuleViolationLocation]
    >;

    if (typeof validation === 'function') {
      finalFilter = filter;
      validateFn = validation;
    } else {
      finalFilter = and(filter, validation);
      validateFn = (req, res, location) => [
        { location, violation: {}, findings: [] },
      ];
    }

    finalFilter = this.addOriginsToFilter(finalFilter);

    const results: RuleFnResult[] = [];

    for (const {
      request,
      response,
    } of this.repository.readTransactionsByHttpFilter(
      finalFilter,
      this.roles,
    )) {
      const matchResult = this.format.matchTransaction(
        request.data,
        response.data,
      );
      const transactionId = matchResult?.[0];

      const location: RuleViolationLocation = transactionId
        ? {
            elementType: 'edge',
            elementId: transactionId,
            label: httpTransactionToLabel(request.data, response.data),
          }
        : httpTransactionToLabel(request.data, response.data);

      results.push(...validateFn(request.data, response.data, location));
    }

    return results;
  }

  validateCapturedHttpTransactions(
    filter: HttpFilterExpression,
    validate: ValidationFn<[CapturedTransaction, string]>,
  ): Promise<RuleFnResult[]> | RuleFnResult[] {
    const finalFilter = this.addOriginsToFilter(filter);

    const results: RuleFnResult[] = [];

    for (const transaction of this.repository.readTransactionsByHttpFilter(
      finalFilter,
      this.roles,
    )) {
      const location = httpTransactionToLabel(
        transaction.request.data,
        transaction.response.data,
      );

      results.push(...validate(transaction, location));
    }

    return results;
  }

  validateCapturedHttpTraces(
    validate: ValidationFn<[CapturedTrace, string]>,
  ): RuleFnResult[] {
    const results: RuleFnResult[] = [];

    for (const trace of this.repository.readAllHttpTraces()) {
      const location = capturedTraceToString(trace);
      results.push(...validate(trace, location));
    }

    return results;
  }
}
