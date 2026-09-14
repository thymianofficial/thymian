import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/recipient-must-parse-and-remove-bws')
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Parsing-and-removing BWS before interpreting a protocol element is internal recipient behaviour; the cleaned value is not re-emitted on the wire, so Thymian has nothing to observe.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'A recipient MUST parse for such bad whitespace and remove it before interpreting the protocol element.',
  )
  .summary(
    'Recipient MUST parse for and remove bad whitespace (BWS) before interpretation.',
  )
  .done();
