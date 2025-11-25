import {
  type HttpRequest,
  type HttpResponse,
  type Logger,
  type ReportFn,
  ThymianFormat,
} from '@thymian/core';
import { and, type HttpFilterExpression } from '@thymian/core';
import type { RuleFnResult } from 'src/rule/rule-fn.js';
import type { RuleViolation } from 'src/rule/rule-violation.js';

import { HttpTransactionRepository } from '../../db/http-transaction-repository.js';
import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  LiveApiContext,
  type ValidationFn,
} from '../api-context.js';
import {
  httpRequestToCommonHttpRequest,
  httpResponseToCommonHttpResponse,
} from '../http-test-api-context.js';
import {
  compileExpressionToGroupByFn,
  compileExpressionToValidateFn,
} from '../utils.js';
import { httpFilterToCommonFilter } from './compilers/http-filter-to-common-filter.js';
import { httpFilterToGroupedCommonFilter } from './compilers/http-filter-to-grouped-common-filter.js';

export class AnalyticsApiContext extends LiveApiContext {
  constructor(
    readonly repository: HttpTransactionRepository,
    logger: Logger,
    format: ThymianFormat,
    reportFn?: ReportFn,
  ) {
    super(format, logger, reportFn);
  }

  override validateCommonHttpTransactions(
    filter: HttpFilterExpression,
    validate:
      | ValidationFn<[CommonHttpRequest, CommonHttpResponse, string]>
      | HttpFilterExpression = filter,
  ): Promise<RuleFnResult> | RuleFnResult {
    let finalFilter!: HttpFilterExpression;
    let validateFn!: ValidationFn<
      [CommonHttpRequest, CommonHttpResponse, string]
    >;

    if (typeof validate === 'function') {
      finalFilter = filter;
      validateFn = validate;
    } else {
      finalFilter = and(filter, validate);
      validateFn = () => true;
    }

    const { sql, params } = httpFilterToCommonFilter(finalFilter);

    this.logger.debug('Executing SQL query:', sql);

    const statement = this.repository.db.prepare<unknown[], { id: string }>(
      sql,
    );

    const results: RuleFnResult = [];

    for (const transaction of statement.iterate(...params)) {
      const [req, res] = this.repository.readTransactionById(transaction.id);
      const matched = this.format.matchTransaction(req, res);

      if (!matched) {
        throw new Error('Invalid HTTP transaction ID.');
      }

      const [transactionId, reqId, resId] = matched;

      const violation = validateFn(
        httpRequestToCommonHttpRequest(reqId, req),
        httpResponseToCommonHttpResponse(resId, res),
        transactionId,
      );

      results.push({
        location: {
          elementType: 'edge',
          elementId: transactionId,
          pointer: '',
        },
        ...(violation === true ? {} : violation),
      });
    }

    return results;
  }

  override validateGroupedCommonHttpTransactions(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse][]],
      RuleViolation | undefined
    >,
  ): Promise<RuleFnResult> | RuleFnResult {
    const { sql, params } = httpFilterToGroupedCommonFilter(filter, groupBy);
    const groupByFn = compileExpressionToGroupByFn(groupBy, this.format);

    this.logger.debug('Executing SQL query:', sql);

    const statement = this.repository.db.prepare<
      unknown[],
      { transactionIds: string }
    >(sql);

    const results: RuleFnResult = [];

    for (const group of statement.iterate(...params)) {
      const ids = group.transactionIds.split(',');

      const transactions = ids
        .map(
          (id) =>
            [id, ...this.repository.readTransactionById(id)] as [
              string,
              HttpRequest,
              HttpResponse,
            ],
        )
        .map(([, req, res]) => {
          const matched = this.format.matchTransaction(req, res);

          if (!matched) {
            throw new Error('Invalid HTTP transaction ID.');
          }

          const [, reqId, resId] = matched;

          return [
            httpRequestToCommonHttpRequest(reqId, req),
            httpResponseToCommonHttpResponse(resId, res),
          ] as [CommonHttpRequest, CommonHttpResponse];
        });

      if (!transactions[0]) {
        continue;
      }

      const key = groupByFn(transactions[0][0], transactions[0][1]);

      const violation = validationFn(key, transactions);

      if (violation) {
        results.push(violation);
      }
    }

    return results;
  }
}
