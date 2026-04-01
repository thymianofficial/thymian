import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  createRegExpFromOriginWildcard,
  type HttpFilterExpression,
  isNodeType,
  type LintContext,
  type Logger,
  type PartialBy,
  type ReportFn,
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
  readonly report: ReportFn;
  private readonly violations: RuleViolation[] = [];

  constructor(
    format: ThymianFormat,
    private readonly logger: Logger,
    report: ReportFn = () => undefined,
    private readonly skippedOrigins: string[] = [],
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

  validateCommonHttpTransactions(
    filter: HttpFilterExpression,
    validate:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression = filter,
  ): RuleFnResult {
    const filterFn = httpFilterExpressionToFilter(filter);

    return this.format
      .getThymianHttpTransactions()
      .filter((transaction) => filterFn(transaction, this.format))
      .reduce<RuleViolation[]>((violations, transaction) => {
        if (typeof validate === 'function') {
          const validationResult = validate(
            thymianToCommonHttpRequest(
              transaction.thymianReq,
              transaction.thymianReqId,
            ),
            thymianToCommonHttpResponse(
              transaction.thymianRes,
              transaction.thymianResId,
            ),
            {
              elementType: 'edge',
              elementId: transaction.transactionId,
            },
          );
          if (typeof validationResult === 'boolean' && validationResult) {
            violations.push({
              location: {
                elementType: 'edge',
                elementId: transaction.transactionId,
              } satisfies RuleViolationLocation,
            });
          }

          if (validationResult && typeof validationResult === 'object') {
            violations.push({
              location: {
                elementType: 'edge',
                elementId: transaction.transactionId,
              },
              ...validationResult,
            });
          }
        } else {
          const validateFn = httpFilterExpressionToFilter(validate);

          if (validateFn(transaction, this.format)) {
            violations.push({
              location: {
                elementType: 'edge',
                elementId: transaction.transactionId,
                pointer: '',
              } satisfies RuleViolationLocation,
            });
          }
        }

        return violations;
      }, [])
      .concat(this.violations);
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
  ): RuleFnResult {
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

    return Object.entries(groups)
      .reduce<RuleViolation[]>((violations, [key, group]) => {
        const validationResult = validationFn(
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
        );

        if (validationResult) {
          violations.push(validationResult);
        }

        return violations;
      }, [])
      .concat(this.violations);
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
    ) => PartialBy<RuleViolation, 'location'> | boolean = filterFn,
  ): RuleFnResult {
    return this.format.graph
      .reduceNodes((violations, id, node) => {
        if (!isNodeType(node, 'http-request')) {
          return violations;
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

            if (typeof result === 'boolean' && result) {
              violations.push({
                location: {
                  elementType: 'edge',
                  elementId: transactionId,
                },
              });
            } else if (result) {
              violations.push({
                location: {
                  elementType: 'edge',
                  elementId: transactionId,
                },
                ...result,
              });
            }
          }
        }

        return violations;
      }, [] as RuleViolation[])
      .concat(this.violations);
  }
}
