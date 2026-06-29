import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-anticipate-large-decimal-numerals-for-byte-range',
)
  .severity('error')
  // Informational (outcome 2): this MUST constrains a recipient's internal
  // robustness — it must parse arbitrarily large byte-range numerals without
  // integer-overflow errors. That is a property of the recipient's parser, not
  // a message on the wire, so it cannot be observed in lint, test, or recorded
  // traffic. The previous rule flagged any REQUEST whose Range carried a
  // numeral above Number.MAX_SAFE_INTEGER as an error, but such a request is
  // entirely legal (RFC 9110 imposes no upper bound on the length); large
  // numerals are precisely the input recipients are required to tolerate, so
  // their presence is not a violation. No observable non-conformant condition
  // exists, so this is informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-byte-ranges')
  .description(
    'In the byte-range syntax, first-pos, last-pos, and suffix-length are expressed as decimal number of octets. Since there is no predefined limit to the length of content, recipients MUST anticipate potentially large decimal numerals and prevent parsing errors due to integer conversion overflows.',
  )
  .summary(
    'Recipients MUST anticipate potentially large decimal numerals and prevent parsing errors due to integer conversion overflows.',
  )
  .appliesTo('origin server')
  .done();
