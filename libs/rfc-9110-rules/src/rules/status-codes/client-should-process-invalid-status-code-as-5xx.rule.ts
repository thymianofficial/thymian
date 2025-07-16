import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-should-process-invalid-status-code-as-5xx'
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-status-codes')
  .description(
    'Values outside the range 100..599 are invalid. Implementations often use three-digit integer values outside of that range (i.e., 600..999) for internal communication of non-HTTP status (e.g., library errors). A client that receives a response with an invalid status code SHOULD process the response as if it had a 5xx (Server Error) status code'
  )
  .summary(
    'Clients should process responses with an invalid status code as a 5xx (Server Error) status code.'
  )
  .appliesTo('client')
  .done();
