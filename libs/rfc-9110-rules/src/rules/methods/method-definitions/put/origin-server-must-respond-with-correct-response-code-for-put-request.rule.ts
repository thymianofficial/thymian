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
  'rfc9110/origin-server-must-respond-with-correct-response-code-for-put-request'
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .summary(
    'Origin server MUST sending a 200 (OK), 201 (Created) or 204 (No Content) response, depending on whether a resource was created or updated.'
  )
  .description(
    'If the target resource does not have a current representation and the PUT successfully creates one, then the origin server MUST inform the user agent by sending a 201 (Created) response. If the target resource does have a current representation and that representation is successfully modified in accordance with the state of the enclosed representation, then the origin server MUST send either a 200 (OK) or a 204 (No Content) response to indicate successful completion of the request.'
  )
  .appliesTo('origin server')
  .rule((context) =>
    context.validateCommonHttpTransactions(
      and(method('PUT'), statusCodeRange(200, 299)),
      not(or(statusCode(200), statusCode(201), statusCode(204)))
    )
  )
  .done();
