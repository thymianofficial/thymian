import {
  constant,
  type HttpRequest,
  type HttpResponse,
  httpRule,
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
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      constant(true),
      (
        request: HttpRequest,
        _response: HttpResponse,
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

        const results = validateRequestHeaders(
          request.headers ?? {},
          transaction.thymianReq,
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
  .done();
