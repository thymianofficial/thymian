import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-forward-message-with-invalid-content-length',
)
  .severity('error')
  // Informational (outcome 2): this MUST NOT is about an intermediary FORWARDING
  // a Content-Length that does not match the ABNF (e.g. non-numeric, or the
  // "42, 42" duplicate). Whether such a value is being *forwarded* (as opposed
  // to originated) is intermediary behavior requiring upstream/downstream
  // framing correlation the framework does not provide. The observable part —
  // detecting an ABNF-invalid Content-Length value on the wire — is already
  // surfaced by `recipient-must-handle-large-content-length`, so implementing a
  // forwarding-specific active rule here would either duplicate that check or
  // assert forwarding it cannot observe. Kept informational.
  .type('informational')
  .appliesTo('intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    'Likewise, a sender MUST NOT forward a message with a Content-Length header field value that does not match the ABNF above, with one exception: a recipient of a Content-Length header field value consisting of the same decimal value repeated as a comma-separated list (e.g, "Content-Length: 42, 42") MAY either reject the message as invalid or replace that invalid field value with a single instance of the decimal value, since this likely indicates that a duplicate was generated or combined by an upstream message processor.',
  )
  .summary(
    'a sender MUST NOT forward a message with a Content-Length header field value that does not match the ABNF.',
  )
  .done();
