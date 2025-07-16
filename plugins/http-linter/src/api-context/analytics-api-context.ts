import type { RuleFnResult } from 'src/rule/rule-fn.js';
import type { RuleViolation } from 'src/rule/rule-violation.js';

import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  type FilterFn,
  LiveApiContext,
  type ValidationFn,
} from './api-context.js';

export class AnalyticsApiContext extends LiveApiContext {
  override validateCommonHttpTransactions(
    filterFn: FilterFn<[CommonHttpRequest, CommonHttpResponse, string]>,
    validationFn: ValidationFn<[CommonHttpRequest, CommonHttpResponse, string]>
  ): Promise<RuleFnResult> | RuleFnResult {
    throw new Error('Method not implemented.');
  }
  override validateGroupedCommonHttpTransactions(
    filterFn: FilterFn<[CommonHttpRequest, CommonHttpResponse, string]>,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse][]],
      RuleViolation
    >
  ): Promise<RuleFnResult> | RuleFnResult {
    throw new Error('Method not implemented.');
  }
}
