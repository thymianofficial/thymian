import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/authentication-scheme-must-accept-token-and-quoted-string',
)
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authentication-parameters',
  )
  .description(
    'Authentication scheme definitions need to accept both token and quoted-string notations for parameter values, both for senders and recipients.',
  )
  .appliesTo('server', 'client', 'proxy')
  .done();
