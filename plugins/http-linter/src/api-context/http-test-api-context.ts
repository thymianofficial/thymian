import {
  filter,
  forHttpTransactions,
  generateRequests,
  groupBy,
  type GroupedHttpTestCaseStep,
  httpTest,
  type HttpTestCase,
  type HttpTestCaseStepTransaction,
  type HttpTestContext,
  runRequests,
  type ThymianHttpTransaction,
  toTestCases,
  validateResponses,
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
import type { HttpRequest, HttpResponse } from '@thymian/core';

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

function httpRequestToCommonHttpRequest(
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

function httpResponseToCommonHttpResponse(
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
  constructor(
    private readonly name: string,
    private readonly ctx: HttpTestContext
  ) {
    super();
  }

  async validateGroupedCommonHttpTransactions(
    filterFn: FilterFn<CommonHttpRequest, CommonHttpResponse>,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      string,
      [CommonHttpRequest, CommonHttpResponse][]
    >
  ): Promise<RuleFnResult> {
    const test = httpTest(this.name, (test) =>
      test.pipe(
        forHttpTransactions(),
        filter(({ curr }) =>
          filterFn(
            thymianToCommonHttpRequest(curr.thymianReqId, curr.thymianReq),
            thymianToCommonHttpResponse(curr.thymianResId, curr.thymianRes)
          )
        ),
        groupBy(({ curr, ctx }) =>
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

        if (typeof validationResult === 'boolean' && validationResult) {
          violations.push({});
        }

        if (validationResult && typeof validationResult === 'object') {
          violations.push(validationResult);
        }

        return violations;
      }, [] as RuleViolation[]);
  }

  async validateCommonHttpTransactions(
    filterFn: FilterFn<CommonHttpRequest, CommonHttpResponse>,
    validationFn: ValidationFn<CommonHttpRequest, CommonHttpResponse> = filterFn
  ): Promise<RuleFnResult> {
    const test = httpTest(this.name, (test) =>
      test.pipe(
        forHttpTransactions(),
        filter(({ curr }) =>
          filterFn(
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
              httpResponseToCommonHttpResponse(source, response)
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
      );
  }
}
