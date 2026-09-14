import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-must-not-merge-trailers-unsafely')
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Whether a recipient merges a received trailer field into the header section is an internal decision that happens inside the recipient/intermediary and is not visible in the observed transaction. (Security-relevant: unsafe merging is a request-smuggling/header-injection vector, but it remains intermediary-internal behavior.)',
  )
  // An unsafely merged trailer field is applied as if it had arrived in the
  // header section all along, so a hop that already acted on the header
  // section's absence of that field now disagrees with one that merged it in
  // — the same two-stages-disagree-about-the-message shape as smuggling.
  .tags('security:request-smuggling')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.1')
  .description(
    'Trailer fields can be difficult to process by intermediaries that forward messages from one protocol version to another. If the entire message can be buffered in transit, some intermediaries could merge trailer fields into the header section (as appropriate) before it is forwarded. However, in most cases, the trailers are simply discarded. A recipient MUST NOT merge a trailer field into a header section unless the recipient understands the corresponding header field definition and that definition explicitly permits and defines how trailer field values can be safely merged.',
  )
  .summary(
    'Recipients MUST NOT merge trailer fields into headers unless explicitly safe.',
  )
  .done();
