import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-should-treat-x-compress-as-compress')
  .severity('hint')
  // Informational (outcome 2): this governs how a RECIPIENT interprets a
  // content coding — it SHOULD decode "x-compress" the same way it decodes
  // "compress". Conformance is internal recipient behavior (the decoder
  // mapping) and is not observable from the transaction; the presence of the
  // "x-compress" coding on the wire is perfectly legal and is NOT a violation.
  //
  // The previous implementation flagged every response carrying
  // Content-Encoding: x-compress as a violation, which contradicts the rule
  // (it penalizes a legal coding rather than checking recipient handling).
  // Reclassified to informational with no rule function.
  .type('informational')
  .appliesTo('client', 'user-agent')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4.1.1')
  .description(
    `The "compress" coding is an adaptive Lempel-Ziv-Welch (LZW) coding [Welch] that is commonly produced by the UNIX file compression program "compress". A recipient SHOULD consider "x-compress" to be equivalent to "compress".`,
  )
  .summary(
    'A recipient SHOULD consider "x-compress" to be equivalent to "compress".',
  )
  .done();
