import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/client-may-repeat-request-for-408-response')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-408-request-timeout')
  .description(
    'If the client has an outstanding request in transit, it MAY repeat that request.',
  )
  .appliesTo('client')
  .done();
