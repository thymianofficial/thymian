import type {
  HttpFilterExpression,
  HttpRequest,
  HttpResponse,
} from '@thymian/core';

import type { RuleFnResult } from '../rule/rule-fn.js';
import { ApiContext, type ValidationFn } from './api-context.js';

export abstract class LiveApiContext extends ApiContext {
  abstract validateHttpTransactions(
    filter: HttpFilterExpression,
    validation?:
      | ValidationFn<[HttpRequest, HttpResponse]>
      | HttpFilterExpression,
  ): Promise<RuleFnResult> | RuleFnResult;
}
