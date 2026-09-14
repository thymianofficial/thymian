import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/recipient-must-handle-quoted-pairs-correctly')
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'How a recipient unescapes quoted-pairs is internal parsing behaviour; the resulting interpreted value is never re-emitted on the wire, so there is nothing for Thymian to observe.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.4')
  .description(
    'Recipients that process the value of a quoted-string MUST handle a quoted-pair as if it were replaced by the octet following the backslash.',
  )
  .summary(
    'Recipient processing quoted-strings MUST handle quoted-pairs as if replaced by the octet following the backslash.',
  )
  .done();
