import {
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import type { RuleFnResult } from 'src/rule/rule-fn.js';

import type {
  RuleViolation,
  RuleViolationLocation,
} from '../rule/rule-violation.js';
import {
  ApiContext,
  type CommonHttpRequest,
  type CommonHttpResponse,
  type FilterFn,
  type ValidationFn,
} from './api-context.js';
import {
  thymianToCommonHttpRequest,
  thymianToCommonHttpResponse,
} from './utils.js';

export class StaticApiContext extends ApiContext {
  constructor(readonly format: ThymianFormat) {
    super();
  }

  validateCommonHttpTransactions(
    filterFn: FilterFn<CommonHttpRequest, CommonHttpResponse>,
    validationFn: ValidationFn<CommonHttpRequest, CommonHttpResponse> = filterFn
  ): RuleFnResult {
    return this.format
      .getHttpTransactions()
      .map<[CommonHttpRequest, CommonHttpResponse, string]>(
        ([reqId, resId, transactionId]) => {
          const req = this.format.getNode<ThymianHttpRequest>(reqId);
          const res = this.format.getNode<ThymianHttpResponse>(resId);

          if (!req || !res) {
            throw new Error('Invalid HTTP transaction.');
          }

          return [
            thymianToCommonHttpRequest(reqId, req),
            thymianToCommonHttpResponse(resId, res),
            transactionId,
          ];
        }
      )
      .filter(([req, res]) => filterFn(req, res))
      .reduce((violations, [req, res, transactionId]) => {
        const validationResult = validationFn(req, res);

        if (typeof validationResult === 'boolean' && validationResult) {
          violations.push({
            location: {
              elementType: 'edge',
              elementId: transactionId,
              pointer: '',
            } satisfies RuleViolationLocation,
          });
        }

        if (validationResult && typeof validationResult === 'object') {
          violations.push({
            location: {
              elementType: 'edge',
              elementId: transactionId,
              pointer: '',
            },
            ...validationResult,
          });
        }

        return violations;
      }, [] as RuleViolation[]);
  }

  validateGroupedCommonHttpTransactions(
    filterFn: FilterFn<CommonHttpRequest, CommonHttpResponse>,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      string,
      [CommonHttpRequest, CommonHttpResponse][]
    >
  ): RuleFnResult {
    const groups = this.format
      .getHttpTransactions()
      .map<[CommonHttpRequest, CommonHttpResponse, string]>(
        ([reqId, resId, transactionId]) => {
          const req = this.format.getNode<ThymianHttpRequest>(reqId);
          const res = this.format.getNode<ThymianHttpResponse>(resId);

          if (!req || !res) {
            throw new Error('Invalid HTTP transaction.');
          }

          return [
            thymianToCommonHttpRequest(reqId, req),
            thymianToCommonHttpResponse(resId, res),
            transactionId,
          ];
        }
      )
      .filter(([req, res]) => filterFn(req, res))
      .reduce((groups, [req, res, transactionId]) => {
        const key = groupByFn(req, res);

        (groups[key] ??= []).push([req, res, transactionId]);

        return groups;
      }, {} as Record<string, [CommonHttpRequest, CommonHttpResponse, string][]>);

    return Object.entries(groups).reduce((violations, [key, group]) => {
      const validationResult = validationFn(
        key,
        group.map(([req, res]) => [req, res])
      );

      if (typeof validationResult === 'boolean' && validationResult) {
        violations.push({});
      }

      if (validationResult && typeof validationResult === 'object') {
        violations.push(validationResult);
      }

      return violations;
    }, [] as RuleViolation[]);
  }
}
