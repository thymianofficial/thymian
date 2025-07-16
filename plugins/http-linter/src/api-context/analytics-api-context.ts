import type { RuleFnResult } from 'src/rule/rule-fn.js';

import { LiveApiContext } from './api-context.js';

export class AnalyticsApiContext extends LiveApiContext {
  override validateCommonHttpTransactions():
    | Promise<RuleFnResult>
    | RuleFnResult {
    throw new Error('Method not implemented.');
  }
  override validateGroupedCommonHttpTransactions():
    | Promise<RuleFnResult>
    | RuleFnResult {
    throw new Error('Method not implemented.');
  }
}
