import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  createRegExpFromOriginWildcard,
  type HttpFilterExpression,
  type HttpRequest,
  httpRequestToCommonHttpRequest,
  type HttpResponse,
  httpResponseToCommonHttpResponse,
  type HttpTestCaseResult,
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

  getRuleExecutionDiagnostics(): HttpTesterRuleDiagnostics | undefined {
    return this.diagnosticEntries.length > 0
      ? this.diagnosticEntries
      : undefined;
  }

  async validateGroupedCommonHttpTransactions(
    filterExpr: HttpFilterExpression,
    groupByExpression: HttpFilterExpression,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): Promise<RuleFnResult[]> {
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
    filterExpr: HttpFilterExpression,
    validate:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression = filterExpr,
  ): Promise<RuleFnResult[]> {
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
            const filterFn = httpFilterToTransactionValidationFn(validate);
            if (filterFn(request, response)) {
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
      if (testCase.status === 'failed') {
        const assertionFailure = testCase.results.find(
          (r) => r.type === 'assertion-failure' && !!r.transaction,
        ) as
          | Extract<HttpTestCaseResult, { type: 'assertion-failure' }>
          | undefined;

        if (assertionFailure && assertionFailure.transaction) {
          // Mark the case as violated for status derivation, but keep the
          // assertion detail on the raw test-case `results`; the report mapping
          // (index.ts `buildTestStep`) maps those results into findings so all
          // HttpTestCaseResult → report mapping lives in one place.
          const result: RuleFnResult = {
            location: {
              elementId: assertionFailure.transaction.transactionId,
              elementType: 'edge',
            },
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
        }
      }
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
    filterExpr: HttpFilterExpression,
    validation:
      | ValidationFn<
          [
            HttpRequest,
            HttpResponse,
            {
              elementType: 'node' | 'edge';
              elementId: string;
              pointer?: string;
            },
          ]
        >
      | HttpFilterExpression = filterExpr,
  ): Promise<RuleFnResult[]> {
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

          const location: RuleViolationLocation = {
            elementType: 'edge',
            elementId: source.transactionId,
            pointer: '',
          };

          const results: RuleFnResult[] = [];
          if (typeof validation === 'function') {
            results.push(...validation(request, response, location));
          } else {
            const filterFn = httpFilterToTransactionValidationFn(validation);
            if (filterFn(request, response)) {
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
