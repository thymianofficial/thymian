import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  createRegExpFromOriginWildcard,
  type HttpFilterExpression,
  type HttpRequest,
  httpRequestToCommonHttpRequest,
  type HttpResponse,
  httpResponseToCommonHttpResponse,
  type ReportFn,
  type RuleFnResult,
  type RuleViolation,
  type RuleViolationLocation,
  type TestContext,
  ThymianFormat,
  type ThymianHttpTransaction,
  type ThymianReportSection,
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

export class HttpTestApiContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals,
> implements TestContext {
  readonly format: ThymianFormat;
  readonly report: ReportFn;
  private readonly violations: RuleViolation[] = [];
  private readonly ctx: HttpTestContext<Locals>;

  constructor(
    private readonly name: string,
    ctx: HttpTestContext<Locals>,
    report: ReportFn = () => undefined,
    private readonly skippedOrigins: string[] = [],
  ) {
    this.report = report;

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

    this.reportSkippedAndFailedTestCases(testResult);

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

    this.reportSkippedAndFailedTestCases(testResult);

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
            } else {
              const validateFn = httpFilterToTransactionValidationFn(validate);

              const validationResult = validateFn(request, response);
              if (typeof validationResult === 'boolean' && validationResult) {
                violations.push({
                  location: {
                    elementType: 'edge',
                    elementId: source.transactionId,
                    pointer: '',
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

  private reportSkippedAndFailedTestCases(testResult: HttpTestResult) {
    const skippedItems: { name: string; reason: string }[] = [];
    const failedItems: { name: string; reason: string }[] = [];

    testResult.cases.forEach((testCase) => {
      if (testCase.status === 'skipped') {
        this.ctx.logger.debug(
          `HTTP test case "${testCase.name}" from test "${this.name}" is skipped.`,
        );

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
      }
    });

    if (skippedItems.length === 0 && failedItems.length === 0) {
      return;
    }

    const sections: ThymianReportSection[] = [];

    if (skippedItems.length > 0) {
      sections.push({
        heading: 'Skipped test cases',
        items: skippedItems.map((item) => ({
          severity: 'info' as const,
          message: item.name,
          details: item.reason,
        })),
      });
    }

    if (failedItems.length > 0) {
      sections.push({
        heading: 'Failed test cases',
        items: failedItems.map((item) => ({
          severity: 'warn' as const,
          message: item.name,
          details: item.reason,
        })),
      });
    }

    const parts: string[] = [];
    if (skippedItems.length > 0) {
      parts.push(
        `${skippedItems.length} test case${skippedItems.length === 1 ? '' : 's'} skipped`,
      );
    }
    if (failedItems.length > 0) {
      parts.push(
        `${failedItems.length} test case${failedItems.length === 1 ? '' : 's'} failed`,
      );
    }

    this.report({
      source: '@thymian/http-tester',
      message: parts.join('and '),
      sections,
    });
  }

  async httpTest(pipeline: HttpTestPipeline<Locals>): Promise<RuleFnResult> {
    const testFn = httpTest(this.name, pipeline);

    const testResult = await testFn(this.ctx);

    this.reportSkippedAndFailedTestCases(testResult);

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

    this.reportSkippedAndFailedTestCases(testResult);

    return testResult.cases
      .filter((testCase) => testCase.status === 'passed')
      .flatMap((testCase) =>
        testCase.steps.flatMap((step) => {
          const violations: RuleViolation[] = [];

          for (const transaction of step.transactions) {
            const { request, response, source } = transaction;

            if (!request || !response || !source) {
              throw new Error();
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
