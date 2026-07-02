import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-anticipate-large-decimal-numerals-for-byte-range',
)
  .severity('error')
  // This MUST constrains a recipient's internal parser robustness (tolerating
  // arbitrarily large byte-range numerals without overflow). That is a property of
  // the parser, not a wire message; large numerals are legal input recipients must
  // tolerate, not a violation.
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
