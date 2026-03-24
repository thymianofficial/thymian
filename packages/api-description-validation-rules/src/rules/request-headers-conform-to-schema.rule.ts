import {
  constant,
  type HttpRequest,
  type HttpResponse,
  httpRule,
  type ThymianHttpRequest,
  validateRequestHeaders,
} from '@thymian/core';

export default httpRule('api-description/request-headers-conform-to-schema')
  .severity('error')
  .type('analytics')
  .description(
    'Request headers must conform to the API description schema. Checks for missing required headers, additional undocumented headers, and validates existing headers against their schema.',
  )
  .summary('Request headers must conform to the API description schema')
  .tags('api-description', 'schema-validation', 'request', 'headers')
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

        const results = validateRequestHeaders(
          request.headers ?? {},
          thymianReq,
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
