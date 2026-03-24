import type {
  HttpFilterExpression,
  HttpRequest,
  HttpResponse,
  LiveApiContext as CoreLiveApiContext,
} from '@thymian/core';

import type { RuleFnResult } from '../rule/rule-fn.js';
import type { RuleViolationLocation } from '../rule/rule-violation.js';
import { ApiContext, type ValidationFn } from './api-context.js';

export abstract class LiveApiContext
  extends ApiContext
  implements CoreLiveApiContext
{
  abstract validateHttpTransactions(
    filter: HttpFilterExpression,
    validation?:
      | ValidationFn<[HttpRequest, HttpResponse, RuleViolationLocation]>
      | HttpFilterExpression,
  ): Promise<RuleFnResult> | RuleFnResult;
}
