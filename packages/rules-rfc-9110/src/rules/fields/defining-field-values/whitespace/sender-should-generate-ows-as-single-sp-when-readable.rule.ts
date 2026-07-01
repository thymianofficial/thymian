import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-generate-ows-as-single-sp-when-readable',
)
  .severity('warn')
  // Informational (not reliably observable): OWS positions are defined per-field
  // by each field's ABNF; without those grammars the framework cannot tell OWS
  // apart from significant value whitespace, and this is a stylistic SHOULD with
  // no hard observable outcome.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'For protocol elements where optional whitespace is preferred to improve readability, a sender SHOULD generate the optional whitespace as a single SP; otherwise, a sender SHOULD NOT generate optional whitespace except as needed to overwrite invalid or unwanted protocol elements during in-place message filtering.',
  )
  .summary(
    'Sender SHOULD generate optional whitespace (OWS) as a single SP when preferred for readability.',
  )
  .done();
