import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-response-without-content-coding',
)
  .severity('warn')
  // informational: requires understanding of available representations and
  // content coding negotiation semantics that cannot be automatically validated
  // from a spec, live response, or recorded traffic alone.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-encoding')
  .description(
    'If a non-empty Accept-Encoding header field is present in a request and none of the available representations for the response have a content coding that is listed as acceptable, the origin server SHOULD send a response without any content coding unless the identity coding is indicated as unacceptable.',
  )
  .summary(
    'The origin server SHOULD send a response without any content coding unless the identity coding is indicated as unacceptable.',
  )
  .appliesTo('origin server')
  .done();
