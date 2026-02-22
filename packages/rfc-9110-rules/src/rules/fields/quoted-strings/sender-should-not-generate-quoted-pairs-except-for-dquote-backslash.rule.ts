import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for unnecessary quoted-pair detection
// Requires detecting quoted-pairs not needed for DQUOTE (%x22) or backslash (%x5C)
// Can be implemented in static context to validate outgoing messages
export default httpRule(
  'rfc9110/sender-should-not-generate-quoted-pairs-except-for-dquote-backslash',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.4')
  .description(
    'A sender SHOULD NOT generate a quoted-pair in a quoted-string except where necessary to quote DQUOTE and backslash octets occurring within that string.',
  )
  .summary(
    'Sender SHOULD NOT generate quoted-pairs in quoted-strings except to quote DQUOTE and backslash.',
  )
  .appliesTo('client', 'server')
  .tags('fields', 'quoted-strings')
  .done();
