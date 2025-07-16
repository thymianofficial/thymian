import { equalsIgnoreCase, httpRule } from '@thymian/http-linter';
import { isValidClientErrorStatusCode } from '@thymian/http-status-codes';

export default httpRule(
  'rfc9110/server-should-send-error-representation-for-4xx-responses'
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-client-error-4xx')
  .summary(
    'The server SHOULD send a representation containing an explanation of the error situation, and whether it is a temporary or permanent condition.'
  )
  .description(
    'The 4xx (Client Error) class of status code indicates that the client seems to have erred. Except when responding to a HEAD request, the server SHOULD send a representation containing an explanation of the error situation, and whether it is a temporary or permanent condition.'
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      (req, res) =>
        !equalsIgnoreCase(req.method, 'head') &&
        isValidClientErrorStatusCode(res.statusCode),
      (_, res) => res.body
    )
  )
  .done();
