import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  type CommonHttpRuleCriteria,
  createRegExpFromOriginWildcard,
  type GroupedCommonHttpRuleCriteria,
  type HttpFilterExpression,
  isNodeType,
  isRuleCriteria,
  type LintContext,
  type LintRuleCriteria,
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
    criteria: CommonHttpRuleCriteria,
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
    appliesToOrCriteria: HttpFilterExpression | CommonHttpRuleCriteria,
    violatedWhenArg?:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression,
  ): RuleFnResult[] {
    // The specification is the observation, so the named form evaluates
    // exactly like the positional one.
    const [appliesTo, violatedWhen] = isRuleCriteria(appliesToOrCriteria)
      ? [appliesToOrCriteria.appliesTo, appliesToOrCriteria.violatedWhen]
      : [appliesToOrCriteria, violatedWhenArg ?? appliesToOrCriteria];
    const isApplicable = httpFilterExpressionToFilter(appliesTo);

    const rawEntries: RuleFnResult[] = this.format
      .getThymianHttpTransactions()
      .filter((transaction) => isApplicable(transaction, this.format))
      .flatMap((transaction) => {
        const location: RuleViolationLocation = {
          elementType: 'edge',
          elementId: transaction.transactionId,
        };

        if (typeof violatedWhen === 'function') {
          return violatedWhen(
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
          const isViolated = httpFilterExpressionToFilter(violatedWhen);
          return isViolated(transaction, this.format)
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
    criteria: GroupedCommonHttpRuleCriteria,
  ): RuleFnResult[];
  validateGroupedCommonHttpTransactions(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): RuleFnResult[];
  validateGroupedCommonHttpTransactions(
    appliesToOrCriteria: HttpFilterExpression | GroupedCommonHttpRuleCriteria,
    groupByArg?: HttpFilterExpression,
    violatedWhenArg?: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): RuleFnResult[] {
    const [appliesTo, groupBy, violatedWhen] = isRuleCriteria(
      appliesToOrCriteria,
    )
      ? [
          appliesToOrCriteria.appliesTo,
          appliesToOrCriteria.groupBy,
          appliesToOrCriteria.violatedWhen,
        ]
      : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        [appliesToOrCriteria, groupByArg!, violatedWhenArg!];
    const isApplicable = httpFilterExpressionToFilter(appliesTo);
    const groupByFn = httpFilterToGroupByFn(groupBy);

    const groups = this.format
      .getThymianHttpTransactions()
      .filter((t) => isApplicable(t, this.format))
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
        violatedWhen(
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

  validateHttpTransactions(criteria: LintRuleCriteria): RuleFnResult[];
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
    appliesToOrCriteria: LintRuleCriteria['appliesTo'] | LintRuleCriteria,
    violatedWhenArg?: LintRuleCriteria['violatedWhen'],
  ): RuleFnResult[] {
    const [appliesTo, violatedWhen] = isRuleCriteria(appliesToOrCriteria)
      ? [appliesToOrCriteria.appliesTo, appliesToOrCriteria.violatedWhen]
      : [appliesToOrCriteria, violatedWhenArg ?? appliesToOrCriteria];
    const rawEntries = this.format.graph.reduceNodes((acc, id, node) => {
      if (!isNodeType(node, 'http-request')) {
        return acc;
      }

      const responsesWithIds = this.format.getHttpResponsesOf(id);
      const responses = responsesWithIds.map(([, res]) => res);

      for (const [resId, res] of responsesWithIds) {
        if (appliesTo(node, res, responses)) {
          const result = violatedWhen(node, res, responses);

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
