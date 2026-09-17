import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/recipient-must-not-recombine-206-with-unknown-range-unit',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    "Constrains the recipient's internal data handling — whether it recombines partial content with a stored representation. Recombination happens entirely inside the recipient and produces no header, status, or body signal on the wire.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'If a 206 (Partial Content) response contains a Content-Range header field with a range unit that the recipient does not understand, the recipient MUST NOT attempt to recombine it with a stored representation.',
  )
  .summary(
    'Recipient must not recombine 206 responses with unknown Content-Range units.',
  )
  .done();
