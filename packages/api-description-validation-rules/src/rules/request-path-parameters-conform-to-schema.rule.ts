import {
  constant,
  type HttpRequest,
  type HttpResponse,
  httpRule,
  type ThymianHttpRequest,
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
      (request: HttpRequest, _response: HttpResponse) => {
        const matched = ctx.format.matchTransaction(request, _response);

        if (!matched) {
          return false;
        }

        const thymianReq = ctx.format.getNode<ThymianHttpRequest>(matched[1]);

        if (!thymianReq) {
          return false;
        }

        const results = validateRequestPathParameters(request.path, thymianReq);
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
