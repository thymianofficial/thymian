import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-forward-message-with-invalid-content-length',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'A forwarding obligation on an intermediary (do not pass on an ABNF-invalid Content-Length). Confirming a message was forwarded rather than originated requires intermediary-role correlation the engine lacks.',
  )
  // An ABNF-invalid or ambiguous (differing, comma-separated) Content-Length forwarded downstream leaves two hops to disagree about which value delimits the body.
  .tags('security:request-smuggling')
  .appliesTo('intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    'Likewise, a sender MUST NOT forward a message with a Content-Length header field value that does not match the ABNF above, with one exception: a recipient of a Content-Length header field value consisting of the same decimal value repeated as a comma-separated list (e.g, "Content-Length: 42, 42") MAY either reject the message as invalid or replace that invalid field value with a single instance of the decimal value, since this likely indicates that a duplicate was generated or combined by an upstream message processor.',
  )
  .summary(
    'a sender MUST NOT forward a message with a Content-Length header field value that does not match the ABNF.',
  )
  .done();
