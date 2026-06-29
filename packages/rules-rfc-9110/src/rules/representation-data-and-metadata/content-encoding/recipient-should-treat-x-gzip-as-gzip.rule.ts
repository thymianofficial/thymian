import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-should-treat-x-gzip-as-gzip')
  .severity('hint')
  // Informational (outcome 2): this governs how a RECIPIENT interprets a
  // content coding — it SHOULD decode "x-gzip" the same way it decodes "gzip".
  // Conformance is internal recipient behavior (the decoder mapping) and is not
  // observable from the transaction; the presence of the "x-gzip" coding on the
  // wire is perfectly legal and is NOT a violation.
  //
  // The previous implementation flagged every response carrying
  // Content-Encoding: x-gzip as a violation, which contradicts the rule (it
  // penalizes a legal coding rather than checking recipient handling).
  // Reclassified to informational with no rule function.
  .type('informational')
  .appliesTo('client', 'user-agent')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4.1.3')
  .description(
    `The "gzip" coding is an LZ77 coding with a 32-bit Cyclic Redundancy Check (CRC) that is commonly produced by the gzip file compression program [RFC1952]. A recipient SHOULD consider "x-gzip" to be equivalent to "gzip".`,
  )
  .summary('A recipient SHOULD consider "x-gzip" to be equivalent to "gzip".')
  .done();
