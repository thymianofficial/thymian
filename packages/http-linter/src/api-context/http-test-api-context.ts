import {
  type HttpFilterExpression,
  type HttpRequest,
  type HttpResponse,
  type ReportFn,
  type ThymianHttpTransaction,
} from '@thymian/core';
import {
  type AssertionFailure,
  filter,
  generateRequests,
  groupBy,
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
} from '@thymian/http-testing';

import type { RuleFnResult } from '../rule/rule-fn.js';
import type {
  RuleViolation,
  RuleViolationLocation,
} from '../rule/rule-violation.js';
import type { ValidationFn } from './api-context.js';
import type { CommonHttpRequest, CommonHttpResponse } from './common-types.js';
import { LiveApiContext } from './live-api-context.js';
import {
  httpRequestToCommonHttpRequest,
  httpResponseToCommonHttpResponse,
} from './utils/http-to-common.js';
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
> extends LiveApiContext {
  private readonly violations: RuleViolation[] = [];
  private readonly ctx: HttpTestContext<Locals>;

  constructor(
    private readonly name: string,
    ctx: HttpTestContext<Locals>,
    report: ReportFn,
    skippedOrigins?: string[],
  ) {
    super(ctx.format, ctx.logger, report, skippedOrigins);
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
    testResult.cases.forEach((testCase) => {
      if (testCase.status === 'skipped') {
        this.ctx.logger.debug(
          `HTTP test case "${testCase.name}" from test "${this.name}" is skipped.`,
        );

        this.report({
          summary:
            'Skipped: ' +
            (testCase.reason ??
              testCase.results
                .filter(
                  (tc) => tc.type !== 'info' && tc.type !== 'assertion-success',
                )
                .map((tc) => tc.message)
                .join('\n')),
          title: testCase.name,
          category: 'HTTP Tests',
          // details: testCasesToString(testCase),
          source: this.name,
          producer: '@thymian/http-linter',
          severity: 'info',
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
          this.report({
            summary:
              testCase.reason ??
              testCase.results
                .filter(
                  (tc) => tc.type !== 'info' && tc.type !== 'assertion-success',
                )
                .map((tc) => tc.message)
                .join('\n'),
            title: testCase.name,
            category: 'Failed HTTP Test Cases',
            source: '',
            producer: '@thymian/http-linter',
            severity: 'info',
          });
        }
      }
    });
  }

  async httpTest(pipeline: HttpTestPipeline<Locals>): Promise<RuleFnResult> {
    const testFn = httpTest(this.name, pipeline);

    const testResult = await testFn(this.ctx);

    this.reportSkippedAndFailedTestCases(testResult);

    return this.violations;
  }

  override async validateHttpTransactions(
    filterExpr: HttpFilterExpression,
    validation:
      | ValidationFn<[HttpRequest, HttpResponse]>
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

            const validationResult = validationFn(request, response);

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

export function testCasesToString(testCase: HttpTestCase): string {
  let text = '';

  text += `${testCase.name}\n`;
  for (const [idx, step] of testCase.steps.entries()) {
    text += `\tStep No. ${idx + 1}\n`;
    for (const [idx, transaction] of step.transactions.entries()) {
      text += `\t\tTransaction No. ${idx + 1}\n`;
      if (transaction.request && transaction.response) {
        text += JSON.stringify(transaction.request, null, 2) + '\n';
        text += JSON.stringify(transaction.response, null, 2) + '\n\n';
      }
    }
  }

  return text;
}
