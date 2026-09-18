import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/origin-server-should-not-rely-on-private-agreements',
)
  .severity('warn')
  .type(
    'informational',
    'only-origin-knows',
    "Whether the server relies on a private, out-of-band agreement to receive GET content is a property of the server's own design intent; nothing in a request, response, or recorded trace reveals it.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-get')
  .description(
    'An origin server SHOULD NOT rely on private agreements to receive content, since participants in HTTP communication are often unaware of intermediaries along the request chain.',
  )
  .appliesTo('origin server')
  .done();
