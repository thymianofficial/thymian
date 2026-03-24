import type { ReportFn } from '../events/report.event.js';
import type { ThymianHttpRequest } from '../format/nodes/http-request.node.js';
import type { ThymianHttpResponse } from '../format/nodes/http-response.node.js';
import type { ThymianFormat } from '../format/thymian-format.js';
import type { ThymianHttpTransaction } from '../format/thymian-format.js';
import type { HttpRequest, HttpResponse } from '../http.js';
import type { HttpFilterExpression } from '../http-filter.js';
import type { HttpTestContextLocals } from '../http-testing/http-test/http-test-context.js';
import type { HttpTestPipeline } from '../http-testing/http-test/http-test-pipeline.js';
import type { PartialBy } from '../utils.js';
import type {
  RuleFnResult,
  RuleViolation,
  RuleViolationLocation,
} from './rule-violation.js';
import type { CapturedTrace, CapturedTransaction } from './traffic.js';

export type CommonHttpRequest = {
  origin: string;
  path: string;
  method: string;
  headers: string[];
  queryParameters: string[];
  cookies: string[];
  mediaType: string;
  body: boolean;
};

export type CommonHttpResponse = {
  statusCode: number;
  mediaType: string;
  headers: string[];
  body: boolean;
  trailers: string[];
};

export type ValidationFn<
  Args extends unknown[],
  R =
    | Omit<RuleViolation, 'location' | 'rule' | 'severity'>
    | boolean
    | undefined,
> = (...args: Args) => R;

export interface ApiContext {
  readonly format: ThymianFormat;
  readonly report: ReportFn;
  reportViolation(violation: RuleViolation): void;
  validateCommonHttpTransactions(
    filter: HttpFilterExpression,
    validationFn?:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression,
  ): Promise<RuleFnResult> | RuleFnResult;
  validateGroupedCommonHttpTransactions(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    validationFn: ValidationFn<
      [
        string,
        [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][],
      ],
      RuleViolation | undefined
    >,
  ): Promise<RuleFnResult> | RuleFnResult;
}

export interface LiveApiContext extends ApiContext {
  validateHttpTransactions(
    filter: HttpFilterExpression,
    validation?:
      | ValidationFn<[HttpRequest, HttpResponse, RuleViolationLocation]>
      | HttpFilterExpression,
  ): Promise<RuleFnResult> | RuleFnResult;
}

export interface LintContext extends ApiContext {
  validateHttpTransactions(
    filterFn: (
      req: ThymianHttpRequest,
      res: ThymianHttpResponse,
      responses: ThymianHttpResponse[],
    ) => boolean,
    validationFn?: (
      req: ThymianHttpRequest,
      res: ThymianHttpResponse,
      responses: ThymianHttpResponse[],
    ) => PartialBy<RuleViolation, 'location'> | boolean,
  ): Promise<RuleFnResult> | RuleFnResult;
}

export interface TestContext extends LiveApiContext {
  httpTest(
    pipeline: HttpTestPipeline<HttpTestContextLocals>,
  ): Promise<RuleFnResult> | RuleFnResult;
}

export interface AnalyzeContext extends LiveApiContext {
  validateCapturedHttpTransactions(
    filter: HttpFilterExpression,
    validate: ValidationFn<[CapturedTransaction, string]>,
  ): Promise<RuleFnResult> | RuleFnResult;
  validateCapturedHttpTraces(
    validate: ValidationFn<[CapturedTrace, string]>,
  ): Promise<RuleFnResult> | RuleFnResult;
}
