import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-may-repeat-request-with-new-credentials-for-403-response',
)
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden')
  .description(
    'The client MAY repeat the request with new or different credentials.',
  )
  .appliesTo('client')
  .done();
