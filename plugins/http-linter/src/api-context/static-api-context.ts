import {
  isNodeType,
  type PartialBy,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import type { HttpFilterExpression } from '@thymian/http-filter';
import type { RuleFnResult } from 'src/rule/rule-fn.js';

import type {
  RuleViolation,
  RuleViolationLocation,
} from '../rule/rule-violation.js';
import {
  ApiContext,
  type CommonHttpRequest,
  type CommonHttpResponse,
  type ValidationFn,
} from './api-context.js';
import {
  compileExpressionToFilterFn,
  thymianToCommonHttpRequest,
  thymianToCommonHttpResponse,
} from './utils.js';

export class StaticApiContext extends ApiContext {
  validateCommonHttpTransactions(
    filter: HttpFilterExpression,
    validate:
      | ValidationFn<[CommonHttpRequest, CommonHttpResponse, string]>
      | HttpFilterExpression
  ): RuleFnResult {
    const filterFn = compileExpressionToFilterFn(filter, this.format);
    const validationFn =
      typeof validate === 'function'
        ? validate
        : compileExpressionToFilterFn(validate, this.format);

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
      .filter(([req, res, transactionId]) => filterFn(req, res, transactionId))
      .reduce((violations, [req, res, transactionId]) => {
        const validationResult = validationFn(req, res, transactionId);

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
    filter: HttpFilterExpression,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse][]],
      RuleViolation
    >
  ): RuleFnResult {
    const filterFn = compileExpressionToFilterFn(filter, this.format);

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
      .filter(([req, res, transactionId]) => filterFn(req, res, transactionId))
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

      if (validationResult) {
        violations.push(validationResult);
      }

      return violations;
    }, [] as RuleViolation[]);
  }

  validateHttpTransactions(
    filterFn: (
      req: ThymianHttpRequest,
      res: ThymianHttpResponse,
      responses: ThymianHttpResponse[]
    ) => boolean,
    validationFn: (
      req: ThymianHttpRequest,
      res: ThymianHttpResponse,
      responses: ThymianHttpResponse[]
    ) => PartialBy<RuleViolation, 'location'> | boolean = filterFn
  ): RuleFnResult {
    return this.format.graph.reduceNodes((violations, id, node) => {
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
            (_, edge) => edge.type === 'http-transaction'
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
    }, [] as RuleViolation[]);
  }
}
