import type {
  HttpFilterExpression,
  HttpRequest,
  HttpResponse,
} from '@thymian/core';

import type { RuleFnResult } from '../rule/rule-fn.js';
import type { RuleViolationLocation } from '../rule/rule-violation.js';
import { ApiContext, type ValidationFn } from './api-context.js';

export abstract class LiveApiContext extends ApiContext {
  abstract validateHttpTransactions(
    filter: HttpFilterExpression,
    validation?:
      | ValidationFn<[HttpRequest, HttpResponse, RuleViolationLocation]>
      | HttpFilterExpression,
  ): Promise<RuleFnResult> | RuleFnResult;
}
