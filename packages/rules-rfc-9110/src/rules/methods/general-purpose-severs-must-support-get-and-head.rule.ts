import { method, not, or, statusCode } from '@thymian/core';
import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  httpRule,
  singleTestCase,
} from '@thymian/core';

export default httpRule(
  'rfc9110/general-purpose-severs-must-support-get-and-head',
)
  .severity('error')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description(
    'All general-purpose servers MUST support the methods GET and HEAD.',
  )
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      or(method('get'), method('head')),
      (_req: CommonHttpRequest, res: CommonHttpResponse, location) => {
        if (res.statusCode !== 501) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'A general-purpose server MUST support GET and HEAD, but this request was answered with 501 (Not Implemented).',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(or(method('get'), method('head')))
        .run({ checkResponse: false })
        .expectForTransactions(not(statusCode(501)))
        .done(),
    ),
  )
  .done();
