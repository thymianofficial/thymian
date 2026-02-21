import {
  and,
  not,
  requestHeader,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-not-include-accept-encoding-for-non-content-coding-415-errors',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-encoding')
  .description(
    'In order to avoid confusion with issues related to media types, servers that fail a request with a 415 status for reasons unrelated to content codings MUST NOT include the Accept-Encoding header field.',
  )
  .summary(
    'Servers that fail a request with a 415 status for reasons unrelated to content codings MUST NOT include the Accept-Encoding header field.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        statusCode(415),
        not(requestHeader('accept-encoding')),
        responseHeader('accept-encoding'),
      ),
    ),
  )
  .done();
