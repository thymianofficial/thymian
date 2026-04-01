import { httpRule } from '@thymian/core';

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
