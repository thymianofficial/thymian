import { method, not, or, statusCode } from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

export default httpRule(
  'rfc9110/general-purpose-severs-must-support-get-and-head',
)
  .severity('error')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description(
    'All general-purpose servers MUST support the methods GET and HEAD.',
  )
  .explanation(
    'Any server meant for general use must handle GET and HEAD requests rather than rejecting them as not implemented; every other method is optional. This matters because GET and HEAD are the baseline of the Web: clients, caches, crawlers, and link checkers assume they can always retrieve a resource or its metadata. A server that fails to support them cannot interoperate with the wider ecosystem, since callers have no reliable way to read what the server exposes.',
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
