import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-generate-range-requests-without-accept-ranges',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A pure MAY for the client. Generating, or not generating, a range request without having seen Accept-Ranges is always conformant.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-ranges')
  .description(
    'A client MAY generate range requests regardless of having received an Accept-Ranges field. The information only provides advice for the sake of improving performance and reducing unnecessary network transfers.',
  )
  .summary(
    'A client may generate range requests regardless of having received an Accept-Ranges field.',
  )
  .appliesTo('client')
  .done();
