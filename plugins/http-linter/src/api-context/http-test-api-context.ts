import {
  authorizeRequests,
  type DefineStepOptions,
  filter,
  forHttpTransactions,
  generateRequests,
  type HttpRequest,
  type HttpResponse,
  httpTest,
  type HttpTestContext,
  type HttpTestFn,
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

function httpRequestToCommonHttpRequest(
  source: ThymianHttpTransaction,
  request: HttpRequest
): CommonHttpRequest {
  return {
    id: source.thymianReqId,
    origin: request.origin,
    path: request.path,
    method: request.method,
    headers: Object.keys(request.headers),
    queryParameters: Array.from(
      new URLSearchParams(request.path.split('?')[1] ?? '').keys()
    ),
    cookies: [],
    mediaType: request.headers['content-type'] ?? '',
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

export class HttpTestApiContext extends LiveApiContext {
  constructor(
    private readonly name: string,
    private readonly ctx: HttpTestContext
  ) {
    super();
  }

  validateGroupedCommonHttpTransactions(
    filterFn: FilterFn<
      CommonHttpRequest,
      CommonHttpResponse,
      CommonHttpResponse[]
    >,
    groupByFn: (req: CommonHttpRequest, res: CommonHttpResponse) => string,
    validationFn: ValidationFn<
      string,
      [CommonHttpRequest, CommonHttpResponse][]
    >
  ): Promise<RuleFnResult> | RuleFnResult {
    return [];
  }

  async validate(fn: HttpTestFn): Promise<RuleFnResult> {
    const result = await httpTest(this.name, fn)(this.ctx);

    return [];
  }

  async validateCommonHttpTransactions(
    filterFn: FilterFn<
      CommonHttpRequest,
      CommonHttpResponse,
      CommonHttpResponse[]
    >,
    validationFn: ValidationFn<CommonHttpRequest, CommonHttpResponse> = filterFn
  ): Promise<RuleFnResult> {
    console.log('validateCommonHttpTransactions' + this.name);
    const test = httpTest(this.name, (test) =>
      test.pipe(
        forHttpTransactions(),
        filter(({ ctx, curr }) =>
          filterFn(
            thymianToCommonHttpRequest(curr.thymianReqId, curr.thymianReq),
            thymianToCommonHttpResponse(curr.thymianResId, curr.thymianRes),
            ctx.format
              .getNeighboursOfType(curr.thymianReqId, 'http-response')
              .map(([resId, res]) => thymianToCommonHttpResponse(resId, res))
          )
        ),
        toTestCases(),
        generateRequests(),
        authorizeRequests(),
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
