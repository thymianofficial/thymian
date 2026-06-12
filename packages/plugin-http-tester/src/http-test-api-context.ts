import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  createRegExpFromOriginWildcard,
  type HttpFilterExpression,
  type HttpRequest,
  httpRequestToCommonHttpRequest,
  type HttpResponse,
  httpResponseToCommonHttpResponse,
  httpTestResultToRuleFindings,
  type RuleFinding,
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
  type HttpTestCaseResult,
  type HttpTestCaseStepTransaction,
  type HttpTestContext,
  type HttpTestContextLocals,
  type HttpTestPipeline,
  type HttpTestResult,
  mapToGroupedTestCase,
  type ReportHttpTransaction,
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

export interface HttpTesterRuleDiagnostics {
  skippedCases: Array<{
    name: string;
    reason: string;
  }>;
  failedCases: Array<{
    name: string;
    reason: string;
  }>;
  /**
   * Passed test cases as raw collection data. The per-assertion `results` are
   * intentionally NOT flattened into `findings`; the mapping layer nests them
   * under one `test-case-pass` summary finding per case.
   */
  passedCases: Array<{
    name: string;
    durationMilliseconds?: number;
    results: HttpTestCaseResult[];
  }>;
  findings: RuleFinding[];
  /** HTTP transactions dispatched by the test cases, regardless of case status. */
  httpTransactions: ReportHttpTransaction[];
}

export class HttpTestApiContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals,
> implements TestContext<HttpTesterRuleDiagnostics> {
  readonly format: ThymianFormat;
  private readonly violations: RuleViolation[] = [];
  private readonly ctx: HttpTestContext<Locals>;
  private diagnostics?: HttpTesterRuleDiagnostics;

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
    return this.diagnostics;
  }

  async validateGroupedCommonHttpTransactions(
    filterExpr: HttpFilterExpression,
    groupByExpression: HttpFilterExpression,
    validationFn: ValidationFn<
      [
        string,
        [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][],
      ],
      RuleViolation | undefined
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

    this.collectTestCaseDiagnostics(testResult);

    return testResult.cases
      .filter((testCase) => testCase.status === 'passed')
      .reduce((violations, value) => {
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

        if (validationResult) {
          violations.push(validationResult);
        }

        return violations;
      }, [] as RuleViolation[])
      .concat(this.violations);
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

    this.collectTestCaseDiagnostics(testResult);

    return testResult.cases
      .filter((testCase) => testCase.status === 'passed')
      .flatMap((testCase) =>
        testCase.steps.flatMap((step) => {
          const violations: RuleViolation[] = [];

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
              if (typeof validationResult === 'boolean' && validationResult) {
                violations.push({
                  location: {
                    elementType: 'edge',
                    elementId: source.transactionId,
                  } satisfies RuleViolationLocation,
                });
              }

              if (validationResult && typeof validationResult === 'object') {
                violations.push({
                  location: {
                    elementType: 'edge',
                    elementId: source.transactionId,
                    pointer: '',
                  },
                  ...validationResult,
                });
              }
            } else {
              const validateFn = httpFilterToTransactionValidationFn(validate);

              const validationResult = validateFn(request, response);
              if (typeof validationResult === 'boolean' && validationResult) {
                violations.push({
                  location: {
                    elementType: 'edge',
                    elementId: source.transactionId,
                  } satisfies RuleViolationLocation,
                });
              }
            }
          }

          return violations;
        }),
      )
      .concat(this.violations);
  }

  private collectTestCaseDiagnostics(testResult: HttpTestResult) {
    const skippedItems: HttpTesterRuleDiagnostics['skippedCases'] = [];
    const failedItems: HttpTesterRuleDiagnostics['failedCases'] = [];
    const passedItems: HttpTesterRuleDiagnostics['passedCases'] = [];
    const findings: RuleFinding[] = [];
    const httpTransactions: ReportHttpTransaction[] = [];

    testResult.cases.forEach((testCase) => {
      for (const step of testCase.steps) {
        for (const { request, response } of step.transactions) {
          if (request) {
            httpTransactions.push({ request, response });
          }
        }
      }

      if (testCase.status === 'skipped') {
        this.ctx.logger.debug(
          `HTTP test case "${testCase.name}" from test "${this.name}" is skipped.`,
        );
        findings.push(...httpTestResultToRuleFindings(testCase.results));
        skippedItems.push({
          name: testCase.name,
          reason:
            testCase.reason ??
            testCase.results
              .filter(
                (tc) => tc.type !== 'info' && tc.type !== 'assertion-success',
              )
              .map((tc) => tc.message)
              .join('\n'),
        });
      } else if (testCase.status === 'failed') {
        this.ctx.logger.debug(
          `HTTP test case "${testCase.name}" from test "${this.name}" failed.`,
        );

        findings.push(...httpTestResultToRuleFindings(testCase.results));

        const assertionFailure = testCase.results.find(
          (r) => r.type === 'assertion-failure' && !!r.transaction,
        ) as AssertionFailure;

        if (assertionFailure && assertionFailure.transaction) {
          this.reportViolation({
            location: {
              elementType: 'edge',
              elementId: assertionFailure.transaction.transactionId,
            },
          });
        } else {
          failedItems.push({
            name: testCase.name,
            reason:
              testCase.reason ??
              testCase.results
                .filter(
                  (tc) => tc.type !== 'info' && tc.type !== 'assertion-success',
                )
                .map((tc) => tc.message)
                .join('\n'),
          });
        }
      } else if (testCase.status === 'passed') {
        passedItems.push({
          name: testCase.name,
          ...(testCase.end !== undefined
            ? { durationMilliseconds: testCase.end - testCase.start }
            : {}),
          results: testCase.results,
        });
      }
    });

    if (
      !this.diagnostics &&
      skippedItems.length === 0 &&
      failedItems.length === 0 &&
      passedItems.length === 0 &&
      findings.length === 0 &&
      httpTransactions.length === 0
    ) {
      return;
    }

    this.diagnostics = {
      skippedCases: [
        ...(this.diagnostics?.skippedCases ?? []),
        ...skippedItems,
      ],
      failedCases: [...(this.diagnostics?.failedCases ?? []), ...failedItems],
      passedCases: [...(this.diagnostics?.passedCases ?? []), ...passedItems],
      findings: [...(this.diagnostics?.findings ?? []), ...findings],
      httpTransactions: [
        ...(this.diagnostics?.httpTransactions ?? []),
        ...httpTransactions,
      ],
    };
  }

  async httpTest(pipeline: HttpTestPipeline<Locals>): Promise<RuleFnResult> {
    const testFn = httpTest(this.name, pipeline);

    const testResult = await testFn(this.ctx);

    this.collectTestCaseDiagnostics(testResult);

    return this.violations;
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

    this.collectTestCaseDiagnostics(testResult);

    return testResult.cases
      .filter((testCase) => testCase.status === 'passed')
      .flatMap((testCase) =>
        testCase.steps.flatMap((step) => {
          const violations: RuleViolation[] = [];

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

            if (typeof validationResult === 'boolean' && validationResult) {
              violations.push({
                location: {
                  elementType: 'edge',
                  elementId: source.transactionId,
                  pointer: '',
                } satisfies RuleViolationLocation,
              });
            }

            if (validationResult && typeof validationResult === 'object') {
              violations.push({
                location: {
                  elementType: 'edge',
                  elementId: source.transactionId,
                  pointer: '',
                },
                ...validationResult,
              });
            }
          }

          return violations;
        }),
      )
      .concat(this.violations);
  }
}
