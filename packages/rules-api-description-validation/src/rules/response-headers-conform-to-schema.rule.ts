import {
  type AssertionFailure,
  type HttpRequest,
  type HttpResponse,
  httpRule,
  type HttpTestCaseResult,
  or,
  type RuleViolation,
  type RuleViolationLocation,
  singleTestCase,
  statusCodeRange,
  successfulStatusCode,
  type ThymianHttpTransaction,
  validateHeaders,
} from '@thymian/core';

export default httpRule('thymian/response-headers-must-conform-to-schema')
  .severity('error')
  .type('test', 'analytics')
  .description(
    'Response headers must conform to the API description schema. Checks for missing required headers, additional undocumented headers, and validates existing headers against their schema.',
  )
  .summary('Response headers must conform to the API description schema')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(successfulStatusCode(), statusCodeRange(400, 499)),
      (
        _request: HttpRequest,
        response: HttpResponse,
        location: RuleViolationLocation,
      ) => {
        if (typeof location === 'string') {
          return false;
        }

        const transaction = ctx.format.getThymianHttpTransactionById(
          location.elementId,
        );

        if (!transaction) {
          return false;
        }

        const results = validateHeaders(
          response.headers,
          transaction.thymianRes,
        );
        const failures = results.filter((r) => r.type === 'assertion-failure');

        if (failures.length > 0) {
          return {
            message: failures.map((f) => f.message).join('\n'),
          };
        }

        return false;
      },
    ),
  )
  .overrideTest(async (ctx) => {
    const testResult = await ctx.runHttpTest(
      singleTestCase()
        .forTransactionsWith(
          or(successfulStatusCode(), statusCodeRange(400, 499)),
        )
        .run({ checkHeaders: true })
        .done(),
    );

    return testResult.cases
      .filter((testCase) => testCase.status === 'failed')
      .flatMap((testCase) => {
        const failures = testCase.results.filter(
          (
            r,
          ): r is HttpTestCaseResult &
            AssertionFailure & { transaction: ThymianHttpTransaction } =>
            r.type === 'assertion-failure' && !!r.transaction,
        );

        return failures.map<RuleViolation>((failure) => ({
          location: {
            elementType: 'edge',
            elementId: failure.transaction.transactionId,
          },
          message: failure.message,
        }));
      });
  })
  .done();
