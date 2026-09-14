import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/sender-should-generate-date-at-message-generation',
)
  .severity('hint')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Verifying that the Date value approximates the moment of message generation would require knowing the true message-generation instant, which is not recoverable from a recorded transaction — only receipt time is seen, and the RFC allows the sender to pick any instant during origination.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'A sender that generates a Date header field SHOULD generate its field value as the best available approximation of the date and time of message generation. In theory, the date ought to represent the moment just before generating the message content. In practice, a sender can generate the date value at any time during message origination.',
  )
  .summary(
    'Senders SHOULD generate Date header as close to message generation time as possible.',
  )
  .done();
