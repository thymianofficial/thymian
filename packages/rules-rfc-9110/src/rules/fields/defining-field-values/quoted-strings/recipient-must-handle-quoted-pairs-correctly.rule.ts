import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-must-handle-quoted-pairs-correctly')
  .severity('error')
  // Informational: this MUST describes how the recipient must internally
  // interpret a quoted-pair (treat "\x" as the octet x). It is an internal
  // unquoting behavior of the recipient and produces no observable difference
  // in any message Thymian can lint, test, or analyze. Recorded for
  // documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.4')
  .description(
    'Recipients that process the value of a quoted-string MUST handle a quoted-pair as if it were replaced by the octet following the backslash.',
  )
  .summary(
    'Recipient processing quoted-strings MUST handle quoted-pairs as if replaced by the octet following the backslash.',
  )
  .done();
