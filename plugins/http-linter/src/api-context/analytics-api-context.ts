import type { RuleFnResult } from 'src/rule/rule-fn.js';

import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  type FilterFn,
  LiveApiContext,
  type ValidationFn,
} from './api-context.js';

export class AnalyticsApiContext extends LiveApiContext {
  validateGroupedCommonHttpTransactions(
    filterFn: FilterFn<CommonHttpRequest, CommonHttpResponse>,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      string,
      [CommonHttpRequest, CommonHttpResponse][]
    >
  ): Promise<RuleFnResult> | RuleFnResult {
    throw new Error('Method not implemented.');
  }
  validateCommonHttpTransactions(
    filterFn: FilterFn<CommonHttpRequest, CommonHttpResponse>,
    validationFn?: ValidationFn<CommonHttpRequest, CommonHttpResponse>
  ): Promise<RuleFnResult> | RuleFnResult {
    throw new Error('Method not implemented.');
  }
}
