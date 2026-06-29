import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-may-send-etag-in-trailer')
  .severity('hint')
  // Informational (outcome 2): this is a permissive MAY plus a soft preference —
  // a sender is allowed to put ETag in a trailer, though sending it as a header
  // field is "preferable". Neither sending it as a trailer nor omitting it is
  // non-conformant, so there is nothing to flag.
  //
  // The previous implementation reported a violation for every 2xx response
  // that did NOT carry an ETag trailer, i.e. it flagged the preferred and most
  // common behavior (ETag as a header / no trailer) as a violation. That
  // inverts the rule. Reclassified to informational with no rule function.
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3')
  .description(
    `A sender MAY send the ETag field in a trailer section. However, since trailers are often ignored, it is
    preferable to send ETag as a header field unless the entity tag is generated while sending the content.`,
  )
  .summary(
    'Servers MAY send ETag in trailer section (but header field is preferable).',
  )
  .done();
