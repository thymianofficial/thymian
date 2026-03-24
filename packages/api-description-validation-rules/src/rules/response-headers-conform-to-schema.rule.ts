import {
  type HttpRequest,
  type HttpResponse,
  httpRule,
  or,
  singleTestCase,
  statusCodeRange,
  successfulStatusCode,
  type ThymianHttpResponse,
  validateHeaders,
} from '@thymian/core';

export default httpRule('api-description/response-headers-conform-to-schema')
  .severity('error')
  .type('test', 'analytics')
  .description(
    'Response headers must conform to the API description schema. Checks for missing required headers, additional undocumented headers, and validates existing headers against their schema.',
  )
  .summary('Response headers must conform to the API description schema')
  .tags('api-description', 'schema-validation', 'response', 'headers')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(successfulStatusCode(), statusCodeRange(400, 499)),
      (request: HttpRequest, response: HttpResponse) => {
        const matched = ctx.format.matchTransaction(request, response);

        if (!matched) {
          return false;
        }

        const thymianRes = ctx.format.getNode<ThymianHttpResponse>(matched[2]);

        if (!thymianRes) {
          return false;
        }

        const results = validateHeaders(response.headers, thymianRes);
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
