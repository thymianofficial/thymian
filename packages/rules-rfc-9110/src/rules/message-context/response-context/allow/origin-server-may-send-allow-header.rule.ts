import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/origin-server-may-send-allow-header')
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A permission (MAY send Allow), not a testable constraint; there is no violating behaviour to detect.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-allow')
  .description('Origin server MAY send "Allow" header field in response.')
  .appliesTo('origin server')
  .done();
