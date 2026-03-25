import {
  constant,
  type HttpRequest,
  type HttpResponse,
  httpRule,
  type RuleViolationLocation,
  validateRequestPathParameters,
} from '@thymian/core';

export default httpRule(
  'api-description/request-path-parameters-conform-to-schema',
)
  .severity('error')
  .type('analytics')
  .description(
    'Request path parameters must conform to the API description schema. Validates extracted path parameters against their schema definitions.',
  )
  .summary('Request path parameters must conform to the API description schema')
  .tags('api-description', 'schema-validation', 'request', 'path-parameters')
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

        const results = validateRequestPathParameters(
          request.path,
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
