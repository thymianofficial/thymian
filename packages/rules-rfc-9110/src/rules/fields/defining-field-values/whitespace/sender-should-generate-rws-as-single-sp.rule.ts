import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/sender-should-generate-rws-as-single-sp')
  .severity('warn')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#115',
    "RWS positions are defined per-field by each field's ABNF; without those grammars a generic scan cannot locate RWS separators.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'The RWS rule is used when at least one linear whitespace octet is required to separate field tokens. A sender SHOULD generate RWS as a single SP.',
  )
  .summary('Sender SHOULD generate required whitespace (RWS) as a single SP.')
  .done();
