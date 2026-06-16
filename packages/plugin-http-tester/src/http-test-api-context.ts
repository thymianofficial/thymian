import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  createRegExpFromOriginWildcard,
  type HttpFilterExpression,
  type HttpRequest,
  httpRequestToCommonHttpRequest,
  type HttpResponse,
  httpResponseToCommonHttpResponse,
  type RuleFnResult,
  type RuleViolation,
  type RuleViolationLocation,
  type TestContext,
  ThymianBaseError,
  ThymianFormat,
  type ThymianHttpTransaction,
  thymianRequestToOrigin,
  type ValidationFn,
} from '@thymian/core';
import {
  type AssertionFailure,
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

/** Per-call association of test result with the violations produced by that call. */
export type HttpTesterRuleDiagnostics = Array<{
  testResult: HttpTestResult;
  ruleFnResult: RuleFnResult;
}>;

export class HttpTestApiContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals,
> implements TestContext<HttpTesterRuleDiagnostics> {
  readonly format: ThymianFormat;
  private readonly violations: RuleViolation[] = [];
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

  reportViolation(violation: RuleViolation): void {
    this.violations.push(violation);
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
  ): Promise<RuleFnResult> {
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

    const callViolations: RuleFnResult = [];
    this.collectTestCaseDiagnostics(testResult, callViolations);

    testResult.cases
      .filter((testCase) => testCase.status === 'passed')
      .forEach((value) => {
        const testCase = value as HttpTestCase<[GroupedHttpTestCaseStep]>;
        const { source, transactions } = testCase.steps[0];

        const transactionsToValidate = transactions
          .filter(hasSource)
          .map<
            [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
          >((transaction) => [
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
          ]);

        const validationResult = validationFn(
          source.key,
          transactionsToValidate,
        );

        if (Array.isArray(validationResult)) {
          callViolations.push(...validationResult);
        }
      });

    if (testResult.cases.length > 0) {
      this.diagnosticEntries.push({ testResult, ruleFnResult: callViolations });
    }

    return [
      ...callViolations,
      ...this.violations.map((v) => ({ violation: v, findings: [] })),
    ];
  }

  async validateCommonHttpTransactions(
    filterExpr: HttpFilterExpression,
    validate:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression = filterExpr,
  ): Promise<RuleFnResult> {
    const test = httpTest(
      this.name,
      singleTestCase().forTransactionsWith(filterExpr).run().done(),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult = [];
    this.collectTestCaseDiagnostics(testResult, callViolations);

    testResult.cases
      .filter((testCase) => testCase.status === 'passed')
      .forEach((testCase) =>
        testCase.steps.forEach((step) => {
          for (const transaction of step.transactions) {
            const { request, response, source } = transaction;

            if (!request || !response || !source) {
              throw new Error('Invalid HTTP test case transaction.');
            }

            if (typeof validate === 'function') {
              const validationResult = validate(
                httpRequestToCommonHttpRequest(request, source.thymianReqId),
                httpResponseToCommonHttpResponse(response, source.thymianResId),
                {
                  elementType: 'edge',
                  elementId: source.transactionId,
                },
              );
              if (Array.isArray(validationResult)) {
                callViolations.push(...validationResult);
              } else if (validationResult === true) {
                callViolations.push({
                  violation: {
                    location: {
                      elementType: 'edge',
                      elementId: source.transactionId,
                    } satisfies RuleViolationLocation,
                  },
                  findings: [],
                });
              }
            } else {
              const validateFn = httpFilterToTransactionValidationFn(validate);

              if (validateFn(request, response)) {
                callViolations.push({
                  violation: {
                    location: {
                      elementType: 'edge',
                      elementId: source.transactionId,
                    } satisfies RuleViolationLocation,
                  },
                  findings: [],
                });
              }
            }
          }
        }),
      );

    if (testResult.cases.length > 0) {
      this.diagnosticEntries.push({ testResult, ruleFnResult: callViolations });
    }

    return [
      ...callViolations,
      ...this.violations.map((v) => ({ violation: v, findings: [] })),
    ];
  }

  private collectTestCaseDiagnostics(
    testResult: HttpTestResult,
    callViolations: RuleFnResult,
  ) {
    for (const testCase of testResult.cases) {
      if (testCase.status === 'skipped') {
        this.ctx.logger.debug(
          `HTTP test case "${testCase.name}" from test "${this.name}" is skipped.`,
        );
      } else if (testCase.status === 'failed') {
        this.ctx.logger.debug(
          `HTTP test case "${testCase.name}" from test "${this.name}" failed.`,
        );

        const assertionFailure = testCase.results.find(
          (r) =>
            r.type === 'assertion-failure' &&
            !!(r as AssertionFailure).transaction,
        ) as AssertionFailure | undefined;

        if (assertionFailure?.transaction) {
          callViolations.push({
            violation: {
              location: {
                elementType: 'edge',
                elementId: assertionFailure.transaction.transactionId,
              },
            },
            findings: [],
          });
        }
      }
    }
  }

  async httpTest(pipeline: HttpTestPipeline<Locals>): Promise<RuleFnResult> {
    const testFn = httpTest(this.name, pipeline);

    const testResult = await testFn(this.ctx);

    const callViolations: RuleFnResult = [];
    this.collectTestCaseDiagnostics(testResult, callViolations);

    if (testResult.cases.length > 0) {
      this.diagnosticEntries.push({ testResult, ruleFnResult: callViolations });
    }

    return [
      ...callViolations,
      ...this.violations.map((v) => ({ violation: v, findings: [] })),
    ];
  }

  async runHttpTest(
    pipeline: HttpTestPipeline<Locals>,
  ): Promise<HttpTestResult> {
    const testFn = httpTest(this.name, pipeline);

    return testFn(this.ctx);
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
  ): Promise<RuleFnResult> {
    const validationFn =
      typeof validation === 'function'
        ? validation
        : httpFilterToTransactionValidationFn(validation);

    const test = httpTest(
      this.name,
      singleTestCase().forTransactionsWith(filterExpr).run().done(),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult = [];
    this.collectTestCaseDiagnostics(testResult, callViolations);

    testResult.cases
      .filter((testCase) => testCase.status === 'passed')
      .forEach((testCase) =>
        testCase.steps.forEach((step) => {
          for (const transaction of step.transactions) {
            const { request, response, source } = transaction;

            if (!request || !response || !source) {
              throw new ThymianBaseError(
                'Invalid HTTP test case transaction: missing request, response, or source.',
              );
            }

            const validationResult = validationFn(request, response, {
              elementType: 'edge',
              elementId: source.transactionId,
            });

            if (Array.isArray(validationResult)) {
              callViolations.push(...validationResult);
            } else if (validationResult === true) {
              callViolations.push({
                violation: {
                  location: {
                    elementType: 'edge',
                    elementId: source.transactionId,
                    pointer: '',
                  } satisfies RuleViolationLocation,
                },
                findings: [],
              });
            }
          }
        }),
      );

    if (testResult.cases.length > 0) {
      this.diagnosticEntries.push({ testResult, ruleFnResult: callViolations });
    }

    return [
      ...callViolations,
      ...this.violations.map((v) => ({ violation: v, findings: [] })),
    ];
  }
}
