import { statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/status-code-305-is-deprecated')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-305-use-proxy')
  .description(
    'The 305 (Use Proxy) status code was defined in a previous version of this specification and is now deprecated.',
  )
  .explanation(
    'Do not use the 305 (Use Proxy) status code. It was defined in an earlier version of the HTTP specification and is now deprecated, so it is no longer part of the standard set of responses a server should send. Because it is deprecated, clients cannot be relied on to handle it consistently, which makes it unsuitable for directing client behavior.',
  )
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(305)))
  .done();
