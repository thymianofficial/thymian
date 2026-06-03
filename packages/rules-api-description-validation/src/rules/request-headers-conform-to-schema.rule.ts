import {
  constant,
  type HttpRequest,
  type HttpResponse,
  httpRule,
  httpTestResultToRuleFindings,
  type RuleFnResult,
  type RuleViolationLocation,
  validateRequestHeaders,
} from '@thymian/core';

export default httpRule('thymian/request-headers-must-conform-to-schema')
  .severity('error')
  .type('analytics')
  .description(
    'Request headers must conform to the API description schema. Checks for missing required headers, additional undocumented headers, and validates existing headers against their schema.',
  )
  .summary('Request headers must conform to the API description schema.')
  .rule(async (ctx) => {
    return ctx.validateHttpTransactions(
      constant(true),
      (
        request: HttpRequest,
        _response: HttpResponse,
        location: RuleViolationLocation,
      ): RuleFnResult[] => {
        if (typeof location === 'string') {
          return [
            {
              location,
              findings: [
                {
                  title: 'thymian/request-headers-must-conform-to-schema',
                  kind: 'rule-skip',
                  message: `No matching endpoint found in corresponding API description document.`,
                },
              ],
            },
          ];
        }

        const transaction = ctx.format.getThymianHttpTransactionById(
          location.elementId,
        );

        if (!transaction) {
          return [
            {
              location,
              findings: [
                {
                  title: 'thymian/request-headers-must-conform-to-schema',
                  kind: 'rule-skip',
                  message: `Can't find transaction with given ID ${location.elementId} in Thymian format.`,
                },
              ],
            },
          ];
        }

        const results = validateRequestHeaders(
          request.headers ?? {},
          transaction.thymianReq,
        );
        const failures = results.filter((r) => r.type === 'assertion-failure');

        if (failures.length > 0) {
          return [
            {
              location,
              violation: { message: `${failures.length} assertion(s) failed` },
              findings: httpTestResultToRuleFindings(results),
            },
          ];
        }

        return [{ location, findings: httpTestResultToRuleFindings(results) }];
      },
    );
  })
  .done();
