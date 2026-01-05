import assert from 'node:assert';

import {
  getHeader,
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
  mapToTestCase,
  runRequests,
} from '@thymian/http-testing';

import type { RuleFnResult } from '../../rule/rule-fn.js';
import type {
  RuleViolation,
  RuleViolationLocation,
} from '../../rule/rule-violation.js';
import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  LiveApiContext,
  type ValidationFn,
} from '../api-context.js';
import {
  compileExpressionToFilterFn,
  compileExpressionToGroupByFn,
  compileExpressionToValidateFn,
  thymianToCommonHttpRequest,
  thymianToCommonHttpResponse,
} from '../utils.js';
import { httpFilterToTransactionValidationFn } from './compilers/http-filter-to-transaction-validation-fn.js';

function extractMediaType(req: HttpRequest): string {
  if (!req.headers) {
    return '';
  }

  const ct = getHeader(req.headers, 'content-type');

  if (Array.isArray(ct)) {
    throw new Error('Content-type is a single valued field.');
  }

  return ct ?? '';
}

export function httpRequestToCommonHttpRequest(
  source: string,
  request: HttpRequest,
): CommonHttpRequest {
  return {
    id: source,
    origin: request.origin,
    path: request.path,
    method: request.method,
    headers: Object.keys(request.headers ?? {}),
    queryParameters: Array.from(
      new URLSearchParams(request.path.split('?')[1] ?? '').keys(),
    ),
    cookies: [],
    mediaType: extractMediaType(request),
    body: !!request.body,
  };
}

export function httpResponseToCommonHttpResponse(
  source: string,
  response: HttpResponse,
): CommonHttpResponse {
  return {
    body: !!response.body,
    headers: Object.keys(response.headers),
    id: source,
    mediaType: getHeader(response.headers, 'content-type')?.at(0) ?? '',
    statusCode: response.statusCode,
    trailers: Object.keys(response.trailers),
  };
}

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

  constructor(
    private readonly name: string,
    private readonly ctx: HttpTestContext<Locals>,
    report: ReportFn,
  ) {
    super(ctx.format, ctx.logger, report);
  }

  reportViolation(violation: RuleViolation): void {
    this.violations.push(violation);
  }

  async validateGroupedCommonHttpTransactions(
    filterExpr: HttpFilterExpression,
    groupByExpression: HttpFilterExpression,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse][]],
      RuleViolation | undefined
    >,
  ): Promise<RuleFnResult> {
    const filterFn = compileExpressionToFilterFn(filterExpr, this.format);
    const groupByFn = compileExpressionToGroupByFn(
      groupByExpression,
      this.format,
    );

    const test = httpTest(this.name, (test) =>
      test.pipe(
        filter(({ current }) =>
          filterFn(
            thymianToCommonHttpRequest(
              current.thymianReqId,
              current.thymianReq,
            ),
            thymianToCommonHttpResponse(
              current.thymianResId,
              current.thymianRes,
            ),
            this.getCommonHttpResponsesOfRequest(current.thymianReqId),
            current.transactionId,
          ),
        ),
        groupBy(({ current }) =>
          groupByFn(
            thymianToCommonHttpRequest(
              current.thymianReqId,
              current.thymianReq,
            ),
            thymianToCommonHttpResponse(
              current.thymianResId,
              current.thymianRes,
            ),
          ),
        ),
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

        const transactionToValidate = transactions
          .filter(hasSource)
          .map<[CommonHttpRequest, CommonHttpResponse]>((transaction) => [
            httpRequestToCommonHttpRequest(
              transaction.source.thymianReqId,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              transaction.request!,
            ),
            httpResponseToCommonHttpResponse(
              transaction.source.thymianResId,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              transaction.response!,
            ),
          ]);

        const validationResult = validationFn(
          source.key,
          transactionToValidate,
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
      | ValidationFn<[CommonHttpRequest, CommonHttpResponse, string]>
      | HttpFilterExpression = filterExpr,
  ): Promise<RuleFnResult> {
    const filterFn = compileExpressionToFilterFn(filterExpr, this.format);
    const validationFn =
      typeof validate === 'function'
        ? validate
        : compileExpressionToValidateFn(validate, this.format);

    const test = httpTest(this.name, (transactions) =>
      transactions.pipe(
        filter(({ current }) =>
          filterFn(
            thymianToCommonHttpRequest(
              current.thymianReqId,
              current.thymianReq,
            ),
            thymianToCommonHttpResponse(
              current.thymianResId,
              current.thymianRes,
            ),
            this.getCommonHttpResponsesOfRequest(current.thymianReqId),
            current.transactionId,
          ),
        ),
        mapToTestCase(),
        generateRequests(),
        runRequests(),
      ),
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

            const validationResult = validationFn(
              httpRequestToCommonHttpRequest(source.thymianReqId, request),
              httpResponseToCommonHttpResponse(source.thymianResId, response),
              source.transactionId,
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
            testCase.reason ??
            testCase.results
              .filter(
                (tc) => tc.type !== 'info' && tc.type !== 'assertion-success',
              )
              .map((tc) => tc.message)
              .join('\n'),
          title: testCase.name,
          category: 'Skipped HTTP Test Cases',
          source: '',
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

  assertTransaction(transactionId: string, fn: () => unknown): void {
    try {
      fn();
    } catch (e) {
      if (e instanceof assert.AssertionError) {
        this.reportViolation({
          location: {
            elementType: 'edge',
            elementId: transactionId,
          },
        });
      } else {
        throw e;
      }
    }
  }

  override async validateHttpTransactions(
    filterExpr: HttpFilterExpression,
    validation:
      | ValidationFn<[HttpRequest, HttpResponse]>
      | HttpFilterExpression = filterExpr,
  ): Promise<RuleFnResult> {
    const filterFn = compileExpressionToFilterFn(filterExpr, this.format);
    const validationFn =
      typeof validation === 'function'
        ? validation
        : httpFilterToTransactionValidationFn(validation);

    const test = httpTest(this.name, (transactions) =>
      transactions.pipe(
        filter(({ current }) =>
          filterFn(
            thymianToCommonHttpRequest(
              current.thymianReqId,
              current.thymianReq,
            ),
            thymianToCommonHttpResponse(
              current.thymianResId,
              current.thymianRes,
            ),
            this.getCommonHttpResponsesOfRequest(current.thymianReqId),
            current.transactionId,
          ),
        ),
        mapToTestCase(),
        generateRequests(),
        runRequests(),
      ),
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
