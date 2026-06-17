import {
  constant,
  type HttpRequest,
  type HttpResponse,
  httpRule,
  httpTestResultToRuleFindings,
  type RuleFnResult,
  type RuleViolationLocation,
  validateBodyForRequest,
} from '@thymian/core';

export default httpRule('thymian/request-body-must-conform-to-schema')
  .severity('error')
  .type('analytics')
  .description('Request body must conform to the API description schema.')
  .rule(async (ctx) => {
    return ctx.validateHttpTransactions(
      constant(true),
      (
        request: HttpRequest,
        _response: HttpResponse,
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

        const results = validateBodyForRequest(
          request.body,
          transaction.thymianReq,
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
  .done();
