import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-not-generate-quoted-pairs-in-comments-except-for-parens-backslash',
)
  .severity('warn')
  // Identifying quoted-pairs inside a comment requires knowing which response
  // fields carry comment syntax (e.g. Server, User-Agent) and fully parsing the
  // comment grammar; without a dependable curated set this cannot be checked
  // without false positives.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.4')
  .description(
    'A sender SHOULD NOT generate a quoted-pair in a comment except where necessary to quote parentheses ["(" and ")"] and backslash octets occurring within that comment.',
  )
  .summary(
    'Sender SHOULD NOT generate quoted-pairs in comments except to quote parentheses and backslash.',
  )
  .done();
