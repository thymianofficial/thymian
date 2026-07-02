import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-respond-415-for-unacceptable-content-coding',
)
  .severity('hint')
  // Pure permission (origin server MAY answer 415): both responding 415 and
  // accepting the coding are conformant.
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
