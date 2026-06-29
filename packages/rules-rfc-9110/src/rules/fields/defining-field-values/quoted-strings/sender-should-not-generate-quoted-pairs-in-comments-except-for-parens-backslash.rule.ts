import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-not-generate-quoted-pairs-in-comments-except-for-parens-backslash',
)
  .severity('warn')
  // Informational: detecting an unnecessary quoted-pair inside a comment
  // requires locating comments — a construct only some fields (e.g. User-Agent,
  // Server, Via) permit — and parsing their nested parenthesis grammar. The
  // framework provides no per-field grammar registry to know where comments
  // are syntactically valid, so a generic scan would misfire. Honestly
  // deferred to informational rather than shipping an unsound check. Recorded
  // for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.4')
  .description(
    'A sender SHOULD NOT generate a quoted-pair in a comment except where necessary to quote parentheses ["(" and ")"] and backslash octets occurring within that comment.',
  )
  .summary(
    'Sender SHOULD NOT generate quoted-pairs in comments except to quote parentheses and backslash.',
  )
  .done();
