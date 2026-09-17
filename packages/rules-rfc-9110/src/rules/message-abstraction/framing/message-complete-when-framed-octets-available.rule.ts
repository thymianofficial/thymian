import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/message-complete-when-framed-octets-available')
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A definitional statement of when a message is considered "complete"; it defines a term rather than imposing a requirement.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.1')
  .description(
    'A message is considered "complete" when all of the octets indicated by its framing are available. Note that, when no explicit framing is used, a response message that is ended by the underlying connection\'s close is considered complete even though it might be indistinguishable from an incomplete response, unless a transport-level error indicates that it is not complete.',
  )
  .summary(
    'Message is complete when all framed octets are available or connection closes cleanly.',
  )
  .done();
