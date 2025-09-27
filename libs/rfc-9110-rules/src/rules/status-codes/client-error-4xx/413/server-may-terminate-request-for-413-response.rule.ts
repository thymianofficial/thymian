import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-may-terminate-request-for-413-response')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-413-content-too-large')
  .description(
    'The server MAY terminate the request, if the protocol version in use allows it.',
  )
  .appliesTo('server')
  .done();
