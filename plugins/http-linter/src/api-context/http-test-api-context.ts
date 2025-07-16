import type { HttpRequest, HttpResponse } from '@thymian/core';
import {
  type DefineStepOptions,
  filter,
  forHttpTransactions,
  generateRequests,
  groupBy,
  type GroupedHttpTestCaseStep,
  httpTest,
  type HttpTestCase,
  type HttpTestCaseStepTransaction,
  type HttpTestContext,
  type HttpTestFn,
  isSingleHttpTestCaseStep,
  runRequests,
  type ThymianHttpTransaction,
  toTestCases,
} from '@thymian/http-testing';
import type { RuleFnResult } from 'src/rule/rule-fn.js';

import type {
  RuleViolation,
  RuleViolationLocation,
} from '../rule/rule-violation.js';
import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  type FilterFn,
  LiveApiContext,
  type ValidationFn,
} from './api-context.js';
import {
  thymianToCommonHttpRequest,
  thymianToCommonHttpResponse,
} from './utils.js';

function extractMediaType(req: HttpRequest): string {
  if (!req.headers) {
    return '';
  }

  // TODO upper/lowercase
  if (Array.isArray(req.headers['content-type'])) {
    throw new Error('Content-type is a single valued field.');
  }

  return req.headers['content-type'] ?? '';
}

export function httpRequestToCommonHttpRequest(
  source: ThymianHttpTransaction,
  request: HttpRequest
): CommonHttpRequest {
  return {
    id: source.thymianReqId,
    origin: request.origin,
    path: request.path,
    method: request.method,
    headers: Object.keys(request.headers ?? {}),
    queryParameters: Array.from(
      new URLSearchParams(request.path.split('?')[1] ?? '').keys()
    ),
    cookies: [],
    mediaType: extractMediaType(request),
    body: !!request.body,
  };
}

export function httpResponseToCommonHttpResponse(
  source: ThymianHttpTransaction,
  response: HttpResponse
) {
  return {
    body: !!response.body,
    headers: Object.keys(response.headers),
    id: source.thymianResId,
    mediaType: source.thymianRes.mediaType,
    statusCode: response.statusCode,
    trailers: Object.keys(response.trailers),
  };
}

function hasSource(
  transaction: HttpTestCaseStepTransaction
): transaction is HttpTestCaseStepTransaction & {
  source: ThymianHttpTransaction;
} {
  return 'source' in transaction;
}

export class HttpTestApiContext extends LiveApiContext {
  private readonly violations: RuleViolation[] = [];

  constructor(
    private readonly name: string,
    private readonly ctx: HttpTestContext
  ) {
    super(ctx.format);
  }

  report(violation: RuleViolation): void {
    this.violations.push(violation);
  }

  async validateGroupedCommonHttpTransactions(
    filterFn: FilterFn<[CommonHttpRequest, CommonHttpResponse, string]>,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse][]],
      RuleViolation | undefined
    >
  ): Promise<RuleFnResult> {
    const test = httpTest(this.name, (test) =>
      test.pipe(
        forHttpTransactions(),
        filter(({ curr }) =>
          filterFn(
            thymianToCommonHttpRequest(curr.thymianReqId, curr.thymianReq),
            thymianToCommonHttpResponse(curr.thymianResId, curr.thymianRes),
            curr.transactionId
          )
        ),
        groupBy(({ curr }) =>
          groupByFn(
            thymianToCommonHttpRequest(curr.thymianReqId, curr.thymianReq),
            thymianToCommonHttpResponse(curr.thymianResId, curr.thymianRes)
          )
        ),
        toTestCases(),
        generateRequests(),
        runRequests()
      )
    );

    const testResult = await test(this.ctx);

    return testResult.cases
      .filter((testCase) => testCase.status === 'passed')
      .reduce((violations, value) => {
        const testCase = value as HttpTestCase<[GroupedHttpTestCaseStep]>;
        const { source, transactions } = testCase.steps[0];

        const transactionToValidate = transactions
          .filter(hasSource)
          .map<[CommonHttpRequest, CommonHttpResponse]>((transaction) => [
            httpRequestToCommonHttpRequest(
              transaction.source,
              transaction.request!
            ),
            httpResponseToCommonHttpResponse(
              transaction.source,
              transaction.response!
            ),
          ]);

        const validationResult = validationFn(
          source.key,
          transactionToValidate
        );

        if (validationResult) {
          violations.push(validationResult);
        }

        return violations;
      }, [] as RuleViolation[])
      .concat(this.violations);
  }

  async validateCommonHttpTransactions(
    filterFn: FilterFn<[CommonHttpRequest, CommonHttpResponse, string]>,
    validationFn: ValidationFn<
      [CommonHttpRequest, CommonHttpResponse, string]
    > = filterFn
  ): Promise<RuleFnResult> {
    const test = httpTest(this.name, (test) =>
      test.pipe(
        forHttpTransactions(),
        filter(({ curr }) =>
          filterFn(
            thymianToCommonHttpRequest(curr.thymianReqId, curr.thymianReq),
            thymianToCommonHttpResponse(curr.thymianResId, curr.thymianRes),
            curr.transactionId
          )
        ),
        toTestCases(),
        generateRequests(),
        runRequests()
      )
    );

    const testResult = await test(this.ctx);

    testResult.cases.forEach((testCase) => {
      if (testCase.status === 'skipped' || testCase.status === 'failed') {
        this.ctx.logger.warn(testCase.reason ?? 'Test was skipped.');
      }
    });

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
              httpRequestToCommonHttpRequest(source, request),
              httpResponseToCommonHttpResponse(source, response),
              source.transactionId
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
        })
      )
      .concat(this.violations);
  }

  async test(
    testFnOrOptions: Partial<DefineStepOptions> | HttpTestFn
  ): Promise<RuleFnResult> {
    const testFn = httpTest(this.name, testFnOrOptions);

    const testResult = await testFn(this.ctx);

    const violations: RuleViolation[] = [];

    for (const testCase of testResult.cases) {
      if (testCase.status !== 'failed') {
        this.ctx.logger.error('Test case failed.');
      }

      const lastStep = testCase.steps.at(-1);

      if (!lastStep) {
        continue;
      }

      if (isSingleHttpTestCaseStep(lastStep)) {
        const violation: RuleViolation = {
          location: {
            elementType: 'edge',
            elementId: lastStep.source.transactionId,
          },
        };

        if (testCase.reason) {
          violation.message = testCase.reason;
        }

        violations.push(violation);
      }
    }

    return violations.concat(this.violations);
  }
}
