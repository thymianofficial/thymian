import {
  type HttpRequest,
  type HttpResponse,
  httpRule,
  httpTestResultToRuleFindings,
  or,
  type RuleFnResult,
  type RuleViolationLocation,
  singleTestCase,
  statusCodeRange,
  successfulStatusCode,
  validateHeaders,
} from '@thymian/core';

export default httpRule('thymian/response-headers-must-conform-to-schema')
  .severity('error')
  .type('test', 'analytics')
  .description(
    'Response headers must conform to the API description schema. Checks for missing required headers, additional undocumented headers, and validates existing headers against their schema.',
  )
  .summary('Response headers must conform to the API description schema')
  .rule(async (ctx) => {
    return ctx.validateHttpTransactions(
      or(successfulStatusCode(), statusCodeRange(400, 499)),
      (
        _request: HttpRequest,
        response: HttpResponse,
        location: RuleViolationLocation,
      ): RuleFnResult[] => {
        if (typeof location === 'string') {
          return [];
        }

        const transaction = ctx.format.getThymianHttpTransactionById(
          location.elementId,
        );

        if (!transaction) {
          return [];
        }

        const results = validateHeaders(
          response.headers,
          transaction.thymianRes,
        );
        const failures = results.filter((r) => r.type === 'assertion-failure');

        if (failures.length > 0) {
          return [
            {
              location,
              violationMessage: `${failures.length} assertion(s) failed`,
              findings: httpTestResultToRuleFindings(results),
            },
          ];
        }

        return [];
      },
    );
  })
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(
          or(successfulStatusCode(), statusCodeRange(400, 499)),
        )
        .run({ checkHeaders: true })
        .done(),
    ),
  )
  .done();
