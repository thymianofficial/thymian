import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/recipient-should-ignore-unrecognized-fields')
  .severity('warn')
  .type(
    'informational',
    'peer-not-observable',
    'Ignoring an unrecognized field is a non-action internal to the recipient; there is no distinguishable response signal that reveals whether the peer ignored a field or never saw it.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1')
  .description(
    'Other recipients SHOULD ignore unrecognized header and trailer fields.',
  )
  .summary('Recipients (other than proxies) SHOULD ignore unrecognized fields.')
  .done();
