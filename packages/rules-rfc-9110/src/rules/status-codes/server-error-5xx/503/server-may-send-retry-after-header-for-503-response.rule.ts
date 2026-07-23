import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-send-retry-after-header-for-503-response',
)
  .severity('hint')
  // Permissive MAY: the server *may* send a Retry-After on a 503. Its absence
  // is therefore not a violation.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server-error-5xx')
  .description(
    'The server MAY send a Retry-After header field to suggest an appropriate amount of time for the client to wait before retrying the request.',
  )
  .appliesTo('server')
  .done();
