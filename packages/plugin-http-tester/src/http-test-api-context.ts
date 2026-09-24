import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  type CommonHttpTransactionValidation,
  createRegExpFromOriginWildcard,
  type GroupedCommonHttpTransactionValidation,
  type HttpFilterExpression,
  type HttpRequest,
  httpRequestToCommonHttpRequest,
  type HttpResponse,
  httpResponseToCommonHttpResponse,
  type HttpTestCaseResult,
  type HttpTransactionValidation,
  isHttpValidation,
  type RuleFnResult,
  type RuleViolationLocation,
  type TestContext,
  ThymianBaseError,
  ThymianFormat,
  type ThymianHttpTransaction,
  thymianRequestToOrigin,
  type ValidationFn,
} from '@thymian/core';
import {
  generateRequests,
  type GroupedHttpTestCaseStep,
  httpTest,
  type HttpTestCase,
  type HttpTestCaseStepTransaction,
  type HttpTestContext,
  type HttpTestContextLocals,
  type HttpTestPipeline,
  type HttpTestResult,
  mapToGroupedTestCase,
  runRequests,
  singleTestCase,
} from '@thymian/core';
import { filter, groupBy } from 'rxjs';

import { httpFilterExpressionToFilter } from './visitors/http-filter-expression-to-filter.js';
import { httpFilterToGroupByFn } from './visitors/http-filter-to-static-by-fn.js';
import { httpFilterToTransactionValidationFn } from './visitors/http-filter-to-transaction-validation-fn.js';

function hasSource(
  transaction: HttpTestCaseStepTransaction,
): transaction is HttpTestCaseStepTransaction & {
  source: ThymianHttpTransaction;
} {
  return 'source' in transaction;
}

function isSameLocation(
  a: RuleViolationLocation,
  b: RuleViolationLocation,
): boolean {
  if (typeof a === 'string' || typeof b === 'string') {
    return a === b;
  }
  return a.elementType === b.elementType && a.elementId === b.elementId;
}

type EdgeLocation = {
  elementType: 'node' | 'edge';
  elementId: string;
  pointer?: string;
};

/**
 * Links a single RuleFnResult back to its position in the HTTP test run.
 * stepIndex is absent for test-case-level results (e.g. from httpTest()).
 */
export type RuleFnResultPlacement = {
  result: RuleFnResult;
  testCaseIndex: number;
  stepIndex?: number;
};

/** Per-call association of test result with placement metadata. */
export type HttpTesterRuleDiagnostics = Array<{
  testResult: HttpTestResult;
  placements: RuleFnResultPlacement[];
}>;

export class HttpTestApiContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals,
> implements TestContext<HttpTesterRuleDiagnostics> {
  readonly format: ThymianFormat;
  private readonly ctx: HttpTestContext<Locals>;
  private readonly diagnosticEntries: HttpTesterRuleDiagnostics = [];

  constructor(
    private readonly name: string,
    ctx: HttpTestContext<Locals>,
    private readonly skippedOrigins: string[] = [],
  ) {
    if (skippedOrigins.length === 0) {
      this.format = ctx.format;
    } else {
      const regExps = skippedOrigins.map(createRegExpFromOriginWildcard);

      this.format = ctx.format.filter(
        ({ thymianReq }) =>
          !regExps.some((regExp) =>
            regExp.test(thymianRequestToOrigin(thymianReq)),
          ),
      );
    }

    this.ctx = {
      ...ctx,
      format: this.format,
    };
  }

  /**
   * `appliesTo` selects what to send from the specification; this asks it again
   * of the pair that came back, so a pair it rejects never reaches
   * `violatedWhen` (ADR-0022). The positional form skips this re-check.
   */
  private liveApplicability(appliesTo: HttpFilterExpression) {
    return httpFilterToTransactionValidationFn(appliesTo, this.format);
  }

  getRuleExecutionDiagnostics(): HttpTesterRuleDiagnostics | undefined {
    return this.diagnosticEntries.length > 0
      ? this.diagnosticEntries
      : undefined;
  }

  async validateGroupedCommonHttpTransactions(
    validation: GroupedCommonHttpTransactionValidation,
  ): Promise<RuleFnResult[]>;
  async validateGroupedCommonHttpTransactions(
    filterExpr: HttpFilterExpression,
    groupByExpression: HttpFilterExpression,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): Promise<RuleFnResult[]>;
  async validateGroupedCommonHttpTransactions(
    filterOrValidation:
      HttpFilterExpression | GroupedCommonHttpTransactionValidation,
    groupByArg?: HttpFilterExpression,
    validationFnArg?: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): Promise<RuleFnResult[]> {
    const [filterExpr, groupByExpression, validationFn, appliesTo] =
      isHttpValidation(filterOrValidation)
        ? [
            filterOrValidation.appliesTo,
            filterOrValidation.groupBy,
            filterOrValidation.violatedWhen,
            this.liveApplicability(filterOrValidation.appliesTo),
          ]
        : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          [filterOrValidation, groupByArg!, validationFnArg!, undefined];
    const filterFn = httpFilterExpressionToFilter(filterExpr);
    const groupByFn = httpFilterToGroupByFn(groupByExpression);

    const test = httpTest(this.name, (test) =>
      test.pipe(
        filter(({ current, ctx }) => filterFn(current, ctx.format)),
        groupBy(({ current, ctx }) => groupByFn(current, ctx.format)),
        mapToGroupedTestCase(),
        generateRequests(),
        runRequests(),
      ),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult[] = [];
    const placements: RuleFnResultPlacement[] = [];

    testResult.cases.forEach((value, testCaseIndex) => {
      if (value.status !== 'passed') {
        return;
      }
      const testCase = value as HttpTestCase<[GroupedHttpTestCaseStep]>;
      const { source, transactions } = testCase.steps[0];

      const transactionsToValidate = transactions
        .filter(hasSource)
        .filter(
          ({ request, response, source }) =>
            !appliesTo ||
            (!!request && !!response && appliesTo(request, response, source)),
        )
        .map<[CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]>(
          (transaction) => [
            httpRequestToCommonHttpRequest(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              transaction.request!,
              transaction.source.thymianReqId,
            ),
            httpResponseToCommonHttpResponse(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              transaction.response!,
              transaction.source.thymianResId,
            ),
            {
              elementId: transaction.source.transactionId,
              elementType: 'edge',
            },
          ],
        );

      if (appliesTo && transactionsToValidate.length === 0) {
        return;
      }

      const results = validationFn(source.key, transactionsToValidate);
      callViolations.push(...results);
      for (const result of results) {
        placements.push({ result, testCaseIndex, stepIndex: 0 });
      }
    });

    this.diagnosticEntries.push({ testResult, placements });

    return callViolations;
  }

  async validateCommonHttpTransactions(
    validation: CommonHttpTransactionValidation,
  ): Promise<RuleFnResult[]>;
  async validateCommonHttpTransactions(
    filterExpr: HttpFilterExpression,
    validate?:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression,
  ): Promise<RuleFnResult[]>;
  async validateCommonHttpTransactions(
    filterOrValidation: HttpFilterExpression | CommonHttpTransactionValidation,
    validateArg?:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression,
  ): Promise<RuleFnResult[]> {
    const [filterExpr, validate, appliesTo] = isHttpValidation(
      filterOrValidation,
    )
      ? [
          filterOrValidation.appliesTo,
          filterOrValidation.violatedWhen,
          this.liveApplicability(filterOrValidation.appliesTo),
        ]
      : [filterOrValidation, validateArg ?? filterOrValidation, undefined];

    const test = httpTest(
      this.name,
      singleTestCase().forTransactionsWith(filterExpr).run().done(),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult[] = [];
    const placements: RuleFnResultPlacement[] = [];

    testResult.cases.forEach((testCase, testCaseIndex) => {
      if (testCase.status !== 'passed') {
        return;
      }
      testCase.steps.forEach((step, stepIndex) => {
        for (const transaction of step.transactions) {
          const { request, response, source } = transaction;

          if (!request || !response || !source) {
            throw new Error('Invalid HTTP test case transaction.');
          }

          if (appliesTo && !appliesTo(request, response, source)) {
            continue;
          }

          const location: RuleViolationLocation = {
            elementType: 'edge',
            elementId: source.transactionId,
          };

          const results: RuleFnResult[] = [];
          if (typeof validate === 'function') {
            results.push(
              ...validate(
                httpRequestToCommonHttpRequest(request, source.thymianReqId),
                httpResponseToCommonHttpResponse(response, source.thymianResId),
                location,
              ),
            );
          } else {
            const filterFn = httpFilterToTransactionValidationFn(
              validate,
              this.format,
            );
            if (filterFn(request, response, source)) {
              results.push({
                location: { ...location, pointer: '' },
                violation: {},
                findings: [],
              });
            }
          }
          callViolations.push(...results);
          for (const result of results) {
            if (
              typeof validate !== 'function' ||
              isSameLocation(result.location, location)
            ) {
              placements.push({ result, testCaseIndex, stepIndex });
            }
          }
        }
      });
    });

    this.diagnosticEntries.push({ testResult, placements });

    return callViolations;
  }

  async httpTest(pipeline: HttpTestPipeline<Locals>): Promise<RuleFnResult[]> {
    const testFn = httpTest(this.name, pipeline);

    const testResult = await testFn(this.ctx);

    const ruleFnResult: RuleFnResult[] = [];
    const placements: RuleFnResultPlacement[] = [];

    testResult.cases.forEach((testCase, testCaseIndex) => {
      if (testCase.status !== 'failed') {
        return;
      }

      // A `failed` case is a real *test* failure only when an assertion actually
      // failed. Prefer an assertion failure anchored to a transaction so the
      // violation renders on the right edge/step; otherwise take any assertion
      // failure (e.g. from a top-level `expect`) and surface it at the case level.
      const assertionFailures = testCase.results.filter(
        (r) => r.type === 'assertion-failure',
      ) as Extract<HttpTestCaseResult, { type: 'assertion-failure' }>[];
      const assertionFailure =
        assertionFailures.find((r) => !!r.transaction) ?? assertionFailures[0];

      // No assertion failed ⇒ the case could not be executed (an HTTP-level
      // failure); computeTestCaseStatus intentionally surfaces that as skipped,
      // so leave it unplaced.
      if (assertionFailure === undefined) {
        return;
      }

      // Mark the case as violated for status derivation, keeping the assertion
      // detail on the raw test-case `results`; the report mapping (index.ts
      // `buildTestStep`) maps those results into findings so all
      // HttpTestCaseResult → report mapping lives in one place. When the failure
      // is anchored to a transaction we locate it on that edge; otherwise it is
      // a case-level violation.
      const result: RuleFnResult = assertionFailure.transaction
        ? {
            location: {
              elementId: assertionFailure.transaction.transactionId,
              elementType: 'edge',
            },
            violation: {},
            findings: [],
          }
        : {
            location: `${this.name}:${testCase.name}`,
            violation: {},
            findings: [],
          };
      ruleFnResult.push(result);
      // stepIndex is undefined when the assertion failure has no step location,
      // making this a test-case-level placement (intentional — see createRuns).
      placements.push({
        result,
        testCaseIndex,
        stepIndex: assertionFailure.location?.stepIdx,
      });
    });

    this.diagnosticEntries.push({ testResult, placements });

    return ruleFnResult;
  }

  async runHttpTest(
    pipeline: HttpTestPipeline<Locals>,
  ): Promise<HttpTestResult> {
    const testFn = httpTest(this.name, pipeline);

    const testResult = await testFn(this.ctx);

    this.diagnosticEntries.push({ testResult, placements: [] });

    return testResult;
  }

  async validateHttpTransactions(
    validation: HttpTransactionValidation,
  ): Promise<RuleFnResult[]>;
  async validateHttpTransactions(
    filterExpr: HttpFilterExpression,
    validation?:
      | ValidationFn<[HttpRequest, HttpResponse, EdgeLocation]>
      | HttpFilterExpression,
  ): Promise<RuleFnResult[]>;
  async validateHttpTransactions(
    filterOrValidation: HttpFilterExpression | HttpTransactionValidation,
    validationArg?:
      | ValidationFn<[HttpRequest, HttpResponse, EdgeLocation]>
      | HttpFilterExpression,
  ): Promise<RuleFnResult[]> {
    const [filterExpr, validation, appliesTo] = isHttpValidation(
      filterOrValidation,
    )
      ? [
          filterOrValidation.appliesTo,
          filterOrValidation.violatedWhen,
          this.liveApplicability(filterOrValidation.appliesTo),
        ]
      : [filterOrValidation, validationArg ?? filterOrValidation, undefined];

    const test = httpTest(
      this.name,
      singleTestCase().forTransactionsWith(filterExpr).run().done(),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult[] = [];
    const placements: RuleFnResultPlacement[] = [];

    testResult.cases.forEach((testCase, testCaseIndex) => {
      if (testCase.status !== 'passed') {
        return;
      }
      testCase.steps.forEach((step, stepIndex) => {
        for (const transaction of step.transactions) {
          const { request, response, source } = transaction;

          if (!request || !response || !source) {
            throw new ThymianBaseError(
              'Invalid HTTP test case transaction: missing request, response, or source.',
            );
          }

          if (appliesTo && !appliesTo(request, response, source)) {
            continue;
          }

          const location: RuleViolationLocation = {
            elementType: 'edge',
            elementId: source.transactionId,
            pointer: '',
          };

          const results: RuleFnResult[] = [];
          if (typeof validation === 'function') {
            results.push(...validation(request, response, location));
          } else {
            const filterFn = httpFilterToTransactionValidationFn(
              validation,
              this.format,
            );
            if (filterFn(request, response, source)) {
              results.push({ location, violation: {}, findings: [] });
            }
          }
          callViolations.push(...results);
          for (const result of results) {
            if (
              typeof validation !== 'function' ||
              isSameLocation(result.location, location)
            ) {
              placements.push({ result, testCaseIndex, stepIndex });
            }
          }
        }
      });
    });

    this.diagnosticEntries.push({ testResult, placements });

    return callViolations;
  }
}
