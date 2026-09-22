import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-generate-range-requests-without-accept-ranges',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A client that takes this up sends a Range request on a path whose earlier responses never advertised Accept-Ranges, and a captured trace carries both messages, so the pairing is visible across transactions. The `hint` — every range request this client made waited for an Accept-Ranges advertisement first — is not written yet.',
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
