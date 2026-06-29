import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-forward-incorrect-content-length',
)
  .severity('error')
  // Informational (outcome 2): a violation requires knowing that a forwarded
  // Content-Length is "known to be incorrect" — i.e. that it disagrees with the
  // actual octet length of the message framing the sender received. That needs
  // the true body length of the forwarded message, which the framework does not
  // expose (body presence only, not byte count), and it is a property of an
  // intermediary's forwarding behavior rather than of a single observable
  // transaction. No observable non-conformant condition, so it stays
  // informational.
  .type('informational')
  .appliesTo('intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A sender MUST NOT forward a message with a Content-Length header field value that is known to be incorrect.`,
  )
  .summary(
    'Servers and intermediaries MUST NOT forward messages with known incorrect Content-Length.',
  )
  .done();
