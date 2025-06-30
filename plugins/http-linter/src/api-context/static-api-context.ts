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
    filterFn: FilterFn<
      CommonHttpRequest,
      CommonHttpResponse,
      CommonHttpResponse[]
    >,
    validationFn: ValidationFn<CommonHttpRequest, CommonHttpResponse> = filterFn
  ): RuleFnResult {
    return this.format
      .getHttpTransactions()
      .reduce((violations, [reqId, resId, transactionId]) => {
        const req = this.format.getNode<ThymianHttpRequest>(reqId);
        const res = this.format.getNode<ThymianHttpResponse>(resId);

        if (!req || !res) {
          return violations;
        }

        const neighbours = this.format.getNeighboursOfType(
          reqId,
          'http-response'
        );
        const commonReq = thymianToCommonHttpRequest(reqId, req);
        const commonRes = thymianToCommonHttpResponse(resId, res);

        if (
          !filterFn(
            commonReq,
            commonRes,
            neighbours.map(([id, res]) => thymianToCommonHttpResponse(id, res))
          )
        ) {
          return violations;
        }

        const validationResult = validationFn(commonReq, commonRes);

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
    filterFn: FilterFn<
      CommonHttpRequest,
      CommonHttpResponse,
      CommonHttpResponse[]
    >,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      string,
      [CommonHttpRequest, CommonHttpResponse][]
    >
  ): RuleFnResult {
    const grouped = this.format
      .getHttpTransactions()
      .reduce((groups, [reqId, resId, transactionId]) => {
        const req = this.format.getNode<ThymianHttpRequest>(reqId);
        const res = this.format.getNode<ThymianHttpResponse>(resId);

        if (!req || !res) {
          return groups;
        }

        const neighbours = this.format.getNeighboursOfType(
          reqId,
          'http-response'
        );
        const commonReq = thymianToCommonHttpRequest(reqId, req);
        const commonRes = thymianToCommonHttpResponse(resId, res);

        const neighbouredResponses = neighbours.map(([id, res]) =>
          thymianToCommonHttpResponse(id, res)
        );

        if (!filterFn(commonReq, commonRes, neighbouredResponses)) {
          return groups;
        }

        const key = groupByFn(commonReq, commonRes);

        if (!Object.hasOwn(groups, key)) {
          groups[key] = [];
        }

        groups[key]!.push([commonReq, commonRes]);

        return groups;
      }, {} as Record<string, [CommonHttpRequest, CommonHttpResponse][]>);

    return [];
  }
}
