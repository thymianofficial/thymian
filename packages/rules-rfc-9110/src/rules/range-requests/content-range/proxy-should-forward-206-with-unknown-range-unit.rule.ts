import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/proxy-should-forward-206-with-unknown-range-unit',
)
  .severity('warn')
  .type(
    'informational',
    'peer-internal-behaviour',
    "Governs a proxy's internal forwarding decision. Detecting non-forwarding would require correlating the proxy's upstream and downstream messages and knowing it did not understand the range unit — an internal capability.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'If a 206 (Partial Content) response contains a Content-Range header field with a range unit that the recipient does not understand, a proxy that receives such a message SHOULD forward it downstream.',
  )
  .summary(
    'Proxy should forward 206 responses with unknown Content-Range units downstream.',
  )
  .appliesTo('proxy')
  .done();
