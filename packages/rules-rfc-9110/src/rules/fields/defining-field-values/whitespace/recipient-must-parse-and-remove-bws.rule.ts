import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-must-parse-and-remove-bws')
  .severity('error')
  // Informational: this MUST governs the recipient's internal parsing (it must
  // strip bad whitespace before interpreting an element). It is an internal
  // recipient behavior with no observable effect on the messages Thymian can
  // lint, test, or analyze, and the relevant raw octets are normalized by the
  // HTTP layer before Thymian sees parsed values. Recorded for documentation
  // only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'A recipient MUST parse for such bad whitespace and remove it before interpreting the protocol element.',
  )
  .summary(
    'Recipient MUST parse for and remove bad whitespace (BWS) before interpretation.',
  )
  .done();
