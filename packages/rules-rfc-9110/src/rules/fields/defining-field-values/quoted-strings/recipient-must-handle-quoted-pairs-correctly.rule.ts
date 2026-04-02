import { httpRule } from '@thymian/core';

// TODO: Implement ABNF validation for quoted-pair parsing
// Requires parsing quoted-string and quoted-pair:
//   quoted-string = DQUOTE *( qdtext / quoted-pair ) DQUOTE
//   quoted-pair = "\" ( HTAB / SP / VCHAR / obs-text )
export default httpRule('rfc9110/recipient-must-handle-quoted-pairs-correctly')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.4')
  .description(
    'Recipients that process the value of a quoted-string MUST handle a quoted-pair as if it were replaced by the octet following the backslash.',
  )
  .summary(
    'Recipient processing quoted-strings MUST handle quoted-pairs as if replaced by the octet following the backslash.',
  )
  .tags('fields', 'quoted-strings', 'parsing')
  .done();
