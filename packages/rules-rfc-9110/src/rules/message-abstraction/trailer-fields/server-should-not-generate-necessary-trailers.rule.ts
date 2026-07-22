import { httpRule } from '@thymian/core';

// Conformance turns on the server's belief that a trailer is "necessary for the
// user agent to receive". That intent is internal server state, not derivable
// from the wire, so no observable trailer pattern distinguishes a conformant
// from a non-conformant response. (The related, observable constraint — never
// putting *forbidden* fields in trailers — is enforced by
// `sender-must-not-generate-trailer-unless-permitted`.)
export default httpRule('rfc9110/server-should-not-generate-necessary-trailers')
  .severity('warn')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.1')
  .description(
    'Because of the potential for trailer fields to be discarded in transit, a server SHOULD NOT generate trailer fields that it believes are necessary for the user agent to receive.',
  )
  .summary(
    'Servers SHOULD NOT generate trailer fields necessary for user agents.',
  )
  .done();
