import type { ThymianHttpRequest } from '../format/nodes/http-request.node.js';
import type { ThymianHttpResponse } from '../format/nodes/http-response.node.js';
import type { ThymianFormat } from '../format/thymian-format.js';
import type { HttpRequest, HttpResponse } from '../http.js';
import type { HttpFilterExpression } from '../http-filter.js';
import type { HttpTestResult } from '../http-testing/http-test/http-test.js';
import type { HttpTestContextLocals } from '../http-testing/http-test/http-test-context.js';
import type { HttpTestPipeline } from '../http-testing/http-test/http-test-pipeline.js';
import type { RuleExecutionDiagnosticsProvider } from './rule-runner.js';
import type {
  RuleFinding,
  RuleFnResult,
  RuleViolation,
  RuleViolationLocation,
} from './rule-violation.js';
import type { CapturedTrace, CapturedTransaction } from './traffic.js';

export type CommonHttpRequest = {
  origin: string;
  path: string;
  /** Full request target URI as captured; see {@link HttpRequest.target}. */
  target?: string;
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

export type ValidationFn<Args extends unknown[]> = (
  ...args: Args
) => RuleFnResult[];

export type CommonHttpViolationConditionFn = ValidationFn<
  [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
>;

export type GroupedCommonHttpViolationConditionFn = ValidationFn<
  [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
>;

export type HttpViolationConditionFn = ValidationFn<
  [HttpRequest, HttpResponse, RuleViolationLocation]
>;

/**
 * A rule's criteria: its Applicability and its Violation Condition, named
 * separately in every rule-context call (ADR-0025).
 *
 * `appliesTo` is the rule's Applicability: which transactions it speaks about,
 * asked of whatever the context observes. `violatedWhen` is its Violation
 * Condition: evaluated only on transactions `appliesTo` accepts, against the
 * same observation. As an expression, a matching transaction is a violation.
 */
export type RuleCriteria<TViolatedWhen> = {
  appliesTo: HttpFilterExpression;
  violatedWhen: TViolatedWhen;
};

export type CommonHttpRuleCriteria = RuleCriteria<
  HttpFilterExpression | CommonHttpViolationConditionFn
>;

export type GroupedCommonHttpRuleCriteria =
  RuleCriteria<GroupedCommonHttpViolationConditionFn> & {
    groupBy: HttpFilterExpression;
  };

export type HttpRuleCriteria = RuleCriteria<
  HttpFilterExpression | HttpViolationConditionFn
>;

export type LintRuleCriteria = {
  appliesTo: (
    req: ThymianHttpRequest,
    res: ThymianHttpResponse,
    responses: ThymianHttpResponse[],
  ) => boolean;
  violatedWhen: (
    req: ThymianHttpRequest,
    res: ThymianHttpResponse,
    responses: ThymianHttpResponse[],
  ) => { violation?: RuleViolation; findings?: RuleFinding[] } | boolean;
};

/**
 * Tells the named form of a rule-context call from the positional one, whose
 * first argument is a filter expression or, in `LintContext`, a function.
 */
export function isRuleCriteria<T extends { appliesTo: unknown }>(
  value: T | object,
): value is T {
  return typeof value === 'object' && 'appliesTo' in value;
}

export interface ApiContext<
  TDiagnostics = unknown,
> extends RuleExecutionDiagnosticsProvider<TDiagnostics> {
  readonly format: ThymianFormat;
  validateCommonHttpTransactions(
    criteria: CommonHttpRuleCriteria,
  ): Promise<RuleFnResult[]> | RuleFnResult[];
  validateCommonHttpTransactions(
    filter: HttpFilterExpression,
    validationFn?:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression,
  ): Promise<RuleFnResult[]> | RuleFnResult[];
  validateGroupedCommonHttpTransactions(
    criteria: GroupedCommonHttpRuleCriteria,
  ): Promise<RuleFnResult[]> | RuleFnResult[];
  validateGroupedCommonHttpTransactions(
    filter: HttpFilterExpression,
    groupBy: HttpFilterExpression,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): Promise<RuleFnResult[]> | RuleFnResult[];
}

export interface LiveApiContext<
  TDiagnostics = unknown,
> extends ApiContext<TDiagnostics> {
  validateHttpTransactions(
    criteria: HttpRuleCriteria,
  ): Promise<RuleFnResult[]> | RuleFnResult[];
  validateHttpTransactions(
    filter: HttpFilterExpression,
    validation?:
      | ValidationFn<[HttpRequest, HttpResponse, RuleViolationLocation]>
      | HttpFilterExpression,
  ): Promise<RuleFnResult[]> | RuleFnResult[];
}

export interface LintContext<
  TDiagnostics = unknown,
> extends ApiContext<TDiagnostics> {
  validateHttpTransactions(
    criteria: LintRuleCriteria,
  ): Promise<RuleFnResult[]> | RuleFnResult[];
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
      // TODO check return type (boolean shouldn't be needed anymore)
    ) => { violation?: RuleViolation; findings?: RuleFinding[] } | boolean,
  ): Promise<RuleFnResult[]> | RuleFnResult[];
}

export interface TestContext<
  TDiagnostics = unknown,
> extends LiveApiContext<TDiagnostics> {
  httpTest(
    pipeline: HttpTestPipeline<HttpTestContextLocals>,
  ): Promise<RuleFnResult[]>;
  runHttpTest(
    pipeline: HttpTestPipeline<HttpTestContextLocals>,
  ): Promise<HttpTestResult>;
}

export interface AnalyzeContext<
  TDiagnostics = unknown,
> extends LiveApiContext<TDiagnostics> {
  validateCapturedHttpTransactions(
    filter: HttpFilterExpression,
    validate: ValidationFn<[CapturedTransaction, string]>,
  ): Promise<RuleFnResult[]> | RuleFnResult[];
  validateCapturedHttpTraces(
    validate: ValidationFn<[CapturedTrace, string]>,
  ): Promise<RuleFnResult[]> | RuleFnResult[];
}
