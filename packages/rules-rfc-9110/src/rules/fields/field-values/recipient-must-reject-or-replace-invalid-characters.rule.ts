import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-reject-or-replace-invalid-characters',
)
  .severity('error')
  // Informational (security-relevant — CR/LF/NUL injection): validating this
  // MUST requires sending a request whose field value contains a raw CR, LF,
  // or NUL and observing that the recipient rejects the message or replaces
  // the octet with SP. Thymian's HTTP stack cannot craft and transmit such a
  // deliberately invalid request (the client library forbids these octets in
  // header values), so the trigger condition cannot be produced in test; and a
  // conformant recipient that has already rejected/replaced the octet leaves
  // no observable trace of the original invalid input in recorded traffic.
  // With no way to generate the input and no preserved signal to analyze, it
  // is recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'Field values containing CR, LF, or NUL characters are invalid and dangerous, due to the varying ways that implementations might parse and interpret those characters; a recipient of CR, LF, or NUL within a field value MUST either reject the message or replace each of those characters with SP before further processing or forwarding of that message.',
  )
  .summary(
    'Recipient MUST either reject messages or replace CR, LF, or NUL characters with SP in field values.',
  )
  .done();
