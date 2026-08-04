import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-should-generate-rws-as-single-sp')
  .severity('warn')
  // RWS positions are defined per-field by each field's ABNF; without those
  // grammars a generic scan cannot locate RWS separators, and this is a
  // stylistic SHOULD with no hard observable outcome.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'The RWS rule is used when at least one linear whitespace octet is required to separate field tokens. A sender SHOULD generate RWS as a single SP.',
  )
  .summary('Sender SHOULD generate required whitespace (RWS) as a single SP.')
  .done();
