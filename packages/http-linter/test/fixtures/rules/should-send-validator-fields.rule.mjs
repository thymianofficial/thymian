import {
  and,
  method,
  not,
  or,
  responseHeader,
  statusCode,
} from '@thymian/core';

import { httpRule } from '../../../src/index.ts';

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
