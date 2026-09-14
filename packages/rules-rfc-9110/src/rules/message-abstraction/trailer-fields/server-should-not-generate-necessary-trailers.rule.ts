import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/server-should-not-generate-necessary-trailers')
  .severity('warn')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Conformance turns on the server\'s belief that a trailer is "necessary for the user agent to receive" — internal server state not derivable from the wire.',
  )
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.1')
  .description(
    'Because of the potential for trailer fields to be discarded in transit, a server SHOULD NOT generate trailer fields that it believes are necessary for the user agent to receive.',
  )
  .summary(
    'Servers SHOULD NOT generate trailer fields necessary for user agents.',
  )
  .explanation(
    'The related, observable constraint — never putting forbidden fields in trailers — is enforced by sender-must-not-generate-trailer-unless-permitted.',
  )
  .done();
