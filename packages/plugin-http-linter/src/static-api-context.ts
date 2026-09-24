import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  type CommonHttpTransactionValidation,
  createRegExpFromOriginWildcard,
  type GroupedCommonHttpTransactionValidation,
  type HttpFilterExpression,
  isHttpValidation,
  isNodeType,
  type LintContext,
  type LintHttpTransactionValidation,
  type Logger,
  type RuleFinding,
  type RuleFnResult,
  type RuleViolation,
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

  getRuleExecutionDiagnostics(): undefined {
    return undefined;
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
    // The specification is the observation, so the named form evaluates
    // exactly like the positional one.
    const [filter, validate] = isHttpValidation(filterOrValidation)
      ? [filterOrValidation.appliesTo, filterOrValidation.violatedWhen]
      : [filterOrValidation, validateArg ?? filterOrValidation];
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
                  violation: {},
                  findings: [],
                },
              ]
            : [];
        }
      });

    return rawEntries;
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

    return rawEntries;
  }

  validateHttpTransactions(
    validation: LintHttpTransactionValidation,
  ): RuleFnResult[];
  validateHttpTransactions(
    filterFn: (
      req: ThymianHttpRequest,
      res: ThymianHttpResponse,
      responses: ThymianHttpResponse[],
    ) => boolean,
    validationFn?: (
      req: ThymianHttpRequest,
      res: ThymianHttpResponse,
      responses: ThymianHttpResponse[],
    ) => { violation?: RuleViolation; findings?: RuleFinding[] } | boolean,
  ): RuleFnResult[];
  validateHttpTransactions(
    filterFnOrValidation:
      | LintHttpTransactionValidation['appliesTo']
      | LintHttpTransactionValidation,
    validationFnArg?: LintHttpTransactionValidation['violatedWhen'],
  ): RuleFnResult[] {
    const [filterFn, validationFn] = isHttpValidation(filterFnOrValidation)
      ? [filterFnOrValidation.appliesTo, filterFnOrValidation.violatedWhen]
      : [filterFnOrValidation, validationFnArg ?? filterFnOrValidation];
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
            acc.push({ location, violation: {}, findings: [] });
          } else if (
            result !== false &&
            result !== undefined &&
            result !== null
          ) {
            if (result.violation !== undefined) {
              acc.push({
                location,
                violation: result.violation,
                findings: result.findings ?? [],
              });
            }
          }
        }
      }

      return acc;
    }, [] as RuleFnResult[]);

    return rawEntries;
  }
}
