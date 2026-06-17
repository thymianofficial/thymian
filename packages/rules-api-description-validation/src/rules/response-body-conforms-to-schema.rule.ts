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
  validateBodyForResponse,
} from '@thymian/core';

export default httpRule('thymian/response-body-must-conforms-to-schema')
  .severity('error')
  .type('test', 'analytics')
  .description(
    'Response body for 2xx and 4xx responses must conform to the API description schema.',
  )
  .summary('Response body must conform to the API description schema.')
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

        const results = validateBodyForResponse(
          response.body,
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
        .run({ checkBody: true })
        .done(),
    ),
  )
  .done();
