import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/authentication-scheme-must-accept-token-and-quoted-string',
)
  .severity('error')
  // This constrains how an authentication *scheme definition* is specified — a
  // scheme's grammar must accept both token and quoted-string notations for
  // parameter values, for senders and recipients alike. It is a property of the
  // scheme specification, not of any individual HTTP message on the wire, so
  // there is nothing in a request, response, or recorded transaction to
  // validate.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authentication-parameters',
  )
  .description(
    'Authentication scheme definitions need to accept both token and quoted-string notations for parameter values, both for senders and recipients.',
  )
  .appliesTo('server', 'client', 'proxy')
  .done();
