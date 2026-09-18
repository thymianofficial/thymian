import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/implementation-may-remove-bws-before-processing',
)
  .severity('off')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#115',
    "An intermediary that takes this up forwards the field value with the bad whitespace gone, so its outbound message differs from the inbound one the same captured trace holds. Locating BWS needs the field's own grammar — which whitespace run sits where the ABNF defines BWS — and rules cannot ask for that yet.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'Any content known to be defined as BWS MAY be removed before interpreting it or forwarding the message downstream.',
  )
  .summary('BWS content MAY be removed before interpretation or forwarding.')
  .done();
