import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-may-make-own-decision-to-redirect-request-for-3xx-response-to-put-request',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'The user agent MAY then make its own decision regarding whether or not to redirect the request.',
  )
  .appliesTo('user-agent')
  .done();
