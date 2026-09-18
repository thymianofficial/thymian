import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-reject-or-replace-invalid-characters',
)
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#110',
    'Exercising this rule requires transmitting a field value containing raw CR, LF, or NUL octets; such octets are stripped or rejected at the transport/serialization layer today, so the malformed input needed to probe a recipient cannot be sent yet.',
  )
  // An unfiltered CR, LF, or NUL inside a field value can be interpreted by a
  // downstream parser as starting a new header line or a new message — the
  // classic injection primitive behind response splitting and smuggling —
  // even though this text never uses either word.
  .tags('security:request-smuggling')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'Field values containing CR, LF, or NUL characters are invalid and dangerous, due to the varying ways that implementations might parse and interpret those characters; a recipient of CR, LF, or NUL within a field value MUST either reject the message or replace each of those characters with SP before further processing or forwarding of that message.',
  )
  .summary(
    'Recipient MUST either reject messages or replace CR, LF, or NUL characters with SP in field values.',
  )
  .done();
