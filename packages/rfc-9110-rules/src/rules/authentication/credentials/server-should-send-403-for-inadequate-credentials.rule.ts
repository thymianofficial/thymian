import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-send-403-for-inadequate-credentials',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-credentials')
  .description(
    'A server that receives valid credentials that are not adequate to gain access ought to respond with the 403 (Forbidden) status code.',
  )
  .appliesTo('server')
  .done();
