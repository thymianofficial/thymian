import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/final-recipient-of-trace-request-should-reflect-received-message',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description(
    'The final recipient of the request SHOULD reflect the message received, excluding some fields described below, back to the client as the content of a 200 (OK) response.',
  )
  .appliesTo('server')
  .done();
