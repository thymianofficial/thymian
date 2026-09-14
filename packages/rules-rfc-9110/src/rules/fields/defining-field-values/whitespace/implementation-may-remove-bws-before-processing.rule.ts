import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/implementation-may-remove-bws-before-processing',
)
  .severity('off')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'Removal of BWS is optional internal recipient behaviour before interpreting/forwarding; there is no required outcome to check.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'Any content known to be defined as BWS MAY be removed before interpreting it or forwarding the message downstream.',
  )
  .summary('BWS content MAY be removed before interpretation or forwarding.')
  .done();
