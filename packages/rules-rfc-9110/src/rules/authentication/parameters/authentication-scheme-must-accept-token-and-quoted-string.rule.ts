import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/authentication-scheme-must-accept-token-and-quoted-string',
)
  .severity('error')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    "Constrains how an authentication scheme's grammar is specified — a scheme must accept both token and quoted-string notations for parameter values, for senders and recipients alike. That is a property of the scheme specification, not of any individual HTTP message, so there is nothing in a request, response, or recorded transaction to check.",
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authentication-parameters',
  )
  .description(
    'Authentication scheme definitions need to accept both token and quoted-string notations for parameter values, both for senders and recipients.',
  )
  .appliesTo('server', 'client', 'proxy')
  .done();
