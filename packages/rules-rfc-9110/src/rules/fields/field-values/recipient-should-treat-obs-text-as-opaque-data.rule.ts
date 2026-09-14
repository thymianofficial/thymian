import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/recipient-should-treat-obs-text-as-opaque-data',
)
  .severity('warn')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Treating obs-text as opaque data is internal recipient handling; how the peer interprets those octets produces no distinguishable signal that Thymian can observe.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'A recipient SHOULD treat other allowed octets in field content (i.e., obs-text) as opaque data.',
  )
  .summary('Recipient SHOULD treat obs-text octets as opaque data.')
  .done();
