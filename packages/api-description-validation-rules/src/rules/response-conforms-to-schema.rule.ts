import { httpRule, singleTestCase, successfulStatusCode } from '@thymian/core';

export default httpRule('api-description/response-conforms-to-schema')
  .severity('error')
  .type('test')
  .description(
    'Responses with 2xx status codes must conform to the API description schema (body, headers, and status code).',
  )
  .summary('Response must conform to the API description schema')
  .tags('api-description', 'schema-validation', '2xx')
  .rule((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(successfulStatusCode())
        .run({ checkResponse: true })
        .done(),
    ),
  )
  .done();
