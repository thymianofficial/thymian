import { and, method, not, or, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule(
  'rfc9110/general-purpose-severs-must-support-get-and-head',
)
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description(
    'All general-purpose servers MUST support the methods GET and HEAD.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      or(method('get'), method('head')),
      statusCode(501),
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
