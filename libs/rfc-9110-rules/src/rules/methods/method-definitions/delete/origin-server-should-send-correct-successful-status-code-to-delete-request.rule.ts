import {
  and,
  method,
  not,
  or,
  statusCode,
  statusCodeRange,
} from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-send-correct-successful-status-code-to-delete-request'
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-delete')
  .description(
    'If a DELETE method is successfully applied, the origin server SHOULD send 202 (Accepted), 204 (No Content) or 200 (OK).'
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('DELETE'), statusCodeRange(200, 299)),
      not(or(statusCode(204), statusCode(202), statusCode(200)))
    )
  )
  .done();
