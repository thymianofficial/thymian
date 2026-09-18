import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/sender-should-not-generate-ows-except-when-needed',
)
  .severity('warn')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#115',
    "OWS positions are defined per-field by each field's ABNF; without those grammars the framework cannot identify superfluous OWS.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'For protocol elements where optional whitespace is preferred to improve readability, a sender SHOULD generate the optional whitespace as a single SP; otherwise, a sender SHOULD NOT generate optional whitespace except as needed to overwrite invalid or unwanted protocol elements during in-place message filtering.',
  )
  .summary(
    'Sender SHOULD NOT generate optional whitespace except when needed for overwriting invalid elements.',
  )
  .done();
