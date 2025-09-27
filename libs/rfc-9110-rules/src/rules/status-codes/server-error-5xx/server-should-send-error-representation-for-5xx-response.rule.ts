import {
  and,
  hasResponseBody,
  method,
  not,
  statusCodeRange,
} from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-send-error-representation-for-5xx-response',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server-error-5xx')
  .description(
    'Except when responding to a HEAD request, the server SHOULD send a representation containing an explanation of the error situation, and whether it is a temporary or permanent condition.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(statusCodeRange(500, 599), not(method('HEAD'))),
      not(hasResponseBody()),
    ),
  )
  .done();
