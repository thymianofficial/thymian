import {
  and,
  httpRule,
  method,
  not,
  or,
  responseHeader,
  statusCode,
} from '@thymian/core';

export default httpRule('rfc9110/server-should-send-validator-fields')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(or(method('get'), method('head')), statusCode(200)),
      not(or(responseHeader('etag'), responseHeader('last-modified'))),
    ),
  )
  .done();
