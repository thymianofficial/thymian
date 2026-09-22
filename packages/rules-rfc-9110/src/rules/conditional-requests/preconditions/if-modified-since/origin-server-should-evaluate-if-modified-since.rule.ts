import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- precondition evaluation ordering, not a concern-axis topic
export default httpRule(
  'rfc9110/origin-server-should-evaluate-if-modified-since',
)
  .severity('warn')
  .type(
    'informational',
    'peer-not-observable',
    'Internal evaluation timing is not directly observable.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'When an origin server receives a request that selects a representation and that request includes an If-Modified-Since header field without an If-None-Match header field, the origin server SHOULD evaluate the If-Modified-Since condition per Section 13.2 prior to performing the method.',
  )
  .summary(
    'Origin server SHOULD evaluate If-Modified-Since when If-None-Match is not present.',
  )
  .explanation(
    'The externally checkable consequence — answering 304 when the condition is false — is actively probed by origin-server-should-respond-304-when-if-modified-since-false.',
  )
  .appliesTo('origin server')
  .done();
