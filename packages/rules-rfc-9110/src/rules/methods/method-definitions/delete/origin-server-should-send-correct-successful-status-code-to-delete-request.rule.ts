import {
  and,
  method,
  not,
  or,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-correct-successful-status-code-to-delete-request',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-delete')
  .description(
    'If a DELETE method is successfully applied, the origin server SHOULD send 202 (Accepted), 204 (No Content) or 200 (OK).',
  )
  .explanation(
    'When a DELETE succeeds, the origin server should answer with one of three specific codes: 202 if the deletion is accepted but not yet carried out, 204 if it is done and there is nothing more to say, or 200 if it is done and the response includes a body describing the outcome. Using these expected codes lets clients reliably tell that the deletion worked and how much detail to expect, rather than guessing from an unusual or ambiguous success status.',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('DELETE'), statusCodeRange(200, 299)),
      not(or(statusCode(204), statusCode(202), statusCode(200))),
    ),
  )
  .done();
