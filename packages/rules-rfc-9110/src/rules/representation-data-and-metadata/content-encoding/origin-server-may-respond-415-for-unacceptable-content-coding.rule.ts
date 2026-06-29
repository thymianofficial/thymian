import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-respond-415-for-unacceptable-content-coding',
)
  .severity('hint')
  // Informational (outcome 2): this is a permissive MAY — an origin server is
  // free to respond with 415 for an unacceptable request content coding, but
  // is equally free NOT to (it may decode, ignore, or otherwise process the
  // request). There is therefore no non-conformant condition to detect.
  //
  // The previous implementation flagged every request carrying Content-Encoding
  // that did NOT receive a 415 as a violation, which inverts the requirement:
  // it punished servers for exercising the permission the RFC grants. Whether a
  // given content coding is "unacceptable" to the server is also server-internal
  // state that cannot be observed from the transaction. Reclassified to
  // informational with no rule function.
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4')
  .description(
    `An origin server MAY respond with a status code of 415 (Unsupported Media Type) if a representation in the request message has a content coding that is not acceptable.`,
  )
  .summary(
    'Origin servers MAY respond with 415 for unacceptable content-coding in requests.',
  )
  .done();
