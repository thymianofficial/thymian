import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/origin-server-may-send-allow-header')
  .severity('hint')
  // This is a permission (MAY send Allow), not a testable constraint; there is
  // no violating behaviour to detect.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-allow')
  .description('Origin server MAY send "Allow" header field in response.')
  .appliesTo('origin server')
  .done();
