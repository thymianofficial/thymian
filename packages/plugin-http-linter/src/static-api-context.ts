import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  createRegExpFromOriginWildcard,
  type HttpFilterExpression,
  isNodeType,
  type LintContext,
  type Logger,
  type RuleFinding,
  type RuleFnResult,
  type RuleViolationLocation,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  type ThymianHttpTransaction,
  thymianRequestToOrigin,
  thymianToCommonHttpRequest,
  thymianToCommonHttpResponse,
  type ValidationFn,
} from '@thymian/core';

import { httpFilterExpressionToFilter } from './visitors/http-filter-expression-to-filter.js';
import { httpFilterToGroupByFn } from './visitors/http-filter-to-static-by-fn.js';

export class StaticApiContext implements LintContext {
  readonly format: ThymianFormat;
  private readonly pendingViolations: Array<{
    location: RuleViolationLocation;
    violationMessage?: string;
  }> = [];
  private readonly skippedOrigins: string[];

  constructor(
    format: ThymianFormat,
    private readonly logger: Logger,
    reportOrSkippedOrigins?: (() => void) | string[],
    legacySkippedOrigins: string[] = [],
  ) {
    const skippedOrigins = Array.isArray(reportOrSkippedOrigins)
      ? reportOrSkippedOrigins
      : legacySkippedOrigins;
    this.skippedOrigins = skippedOrigins;
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
  }

  reportViolation(location: RuleViolationLocation, message?: string): void {
    this.pendingViolations.push({ location, violationMessage: message ?? '' });
  }

  getRuleExecutionDiagnostics(): undefined {
    return undefined;
  }

  validateCommonHttpTransactions(
    filter: HttpFilterExpression,
    validate:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression = filter,
  ): RuleFnResult[] {
    const filterFn = httpFilterExpressionToFilter(filter);

    const rawEntries: RuleFnResult[] = this.format
      .getThymianHttpTransactions()
      .filter((transaction) => filterFn(transaction, this.format))
      .flatMap((transaction) => {
        const location: RuleViolationLocation = {
          elementType: 'edge',
          elementId: transaction.transactionId,
        };

        if (typeof validate === 'function') {
          return validate(
            thymianToCommonHttpRequest(
              transaction.thymianReq,
              transaction.thymianReqId,
            ),
            thymianToCommonHttpResponse(
              transaction.thymianRes,
              transaction.thymianResId,
            ),
            location,
          );
        } else {
          const validateFn = httpFilterExpressionToFilter(validate);
          return validateFn(transaction, this.format)
            ? [
                {
                  location: { ...location, pointer: '' },
                  violationMessage: '',
                  findings: [],
                },
              ]
            : [];
        }
      });

    return [
      ...rawEntries,
      ...this.pendingViolations.map(({ location, violationMessage }) => ({
        location,
        violationMessage,
        findings: [],
      })),
    ];
  }

  validateGroupedCommonHttpTransactions(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): RuleFnResult[] {
    const filterFn = httpFilterExpressionToFilter(filter);
    const groupByFn = httpFilterToGroupByFn(groupBy);

    const groups = this.format
      .getThymianHttpTransactions()
      .filter((t) => filterFn(t, this.format))
      .reduce<Record<string, ThymianHttpTransaction[]>>(
        (groups, transaction) => {
          const key = groupByFn(transaction, this.format);
          (groups[key] ??= []).push(transaction);
          return groups;
        },
        {},
      );

    const rawEntries: RuleFnResult[] = Object.entries(groups).flatMap(
      ([key, group]) =>
        validationFn(
          key,
          group.map(
            ({
              thymianReq,
              thymianRes,
              thymianReqId,
              thymianResId,
              transactionId,
            }) => [
              thymianToCommonHttpRequest(thymianReq, thymianReqId),
              thymianToCommonHttpResponse(thymianRes, thymianResId),
              {
                elementType: 'edge',
                elementId: transactionId,
              },
            ],
          ),
        ),
    );

    return [
      ...rawEntries,
      ...this.pendingViolations.map(({ location, violationMessage }) => ({
        location,
        violationMessage,
        findings: [],
      })),
    ];
  }

  validateHttpTransactions(
    filterFn: (
      req: ThymianHttpRequest,
      res: ThymianHttpResponse,
      responses: ThymianHttpResponse[],
    ) => boolean,
    validationFn: (
      req: ThymianHttpRequest,
      res: ThymianHttpResponse,
      responses: ThymianHttpResponse[],
    ) =>
      | { violationMessage?: string; findings?: RuleFinding[] }
      | boolean = filterFn,
  ): RuleFnResult[] {
    const rawEntries = this.format.graph.reduceNodes((acc, id, node) => {
      if (!isNodeType(node, 'http-request')) {
        return acc;
      }

      const responsesWithIds = this.format.getHttpResponsesOf(id);
      const responses = responsesWithIds.map(([, res]) => res);

      for (const [resId, res] of responsesWithIds) {
        if (filterFn(node, res, responses)) {
          const result = validationFn(node, res, responses);

          const transactionId = this.format.graph.findEdge(
            id,
            resId,
            (_, edge) => edge.type === 'http-transaction',
          );

          if (!transactionId) {
            throw new Error('Invalid HTTP transaction ID.');
          }

          const location: RuleViolationLocation = {
            elementType: 'edge',
            elementId: transactionId,
          };

          if (result === true) {
            acc.push({ location, violationMessage: '', findings: [] });
          } else if (
            result !== false &&
            result !== undefined &&
            result !== null
          ) {
            if (result.violationMessage !== undefined) {
              acc.push({
                location,
                violationMessage: result.violationMessage,
                findings: result.findings ?? [],
              });
            }
          }
        }
      }

      return acc;
    }, [] as RuleFnResult[]);

    return [
      ...rawEntries,
      ...this.pendingViolations.map(({ location, violationMessage }) => ({
        location,
        violationMessage,
        findings: [],
      })),
    ];
  }
}
