import {
  constant,
  type HttpRequest,
  type HttpResponse,
  httpRule,
  type ThymianHttpRequest,
  validateBodyForRequest,
} from '@thymian/core';

export default httpRule('api-description/request-body-conforms-to-schema')
  .severity('error')
  .type('analytics')
  .description('Request body must conform to the API description schema.')
  .summary('Request body must conform to the API description schema')
  .tags('api-description', 'schema-validation', 'request', 'body')
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

        const results = validateBodyForRequest(request.body, thymianReq);
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
