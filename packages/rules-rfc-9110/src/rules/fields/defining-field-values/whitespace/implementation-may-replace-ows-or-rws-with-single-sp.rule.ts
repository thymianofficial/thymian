import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/implementation-may-replace-ows-or-rws-with-single-sp',
)
  .severity('off')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#115',
    "An intermediary that takes this up forwards the field value with each run of optional or required whitespace collapsed to one SP, so its outbound message differs from the inbound one the same captured trace holds. Deciding which run is the OWS or RWS the field's grammar defines is a field-grammar question rules cannot ask yet.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'Any content known to be defined as OWS or RWS MAY be replaced with a single SP before interpreting it or forwarding the message downstream.',
  )
  .summary(
    'OWS or RWS content MAY be replaced with a single SP before interpretation or forwarding.',
  )
  .done();
