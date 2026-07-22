import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-not-generate-quoted-pairs-except-for-dquote-backslash',
)
  .severity('warn')
  // Detecting an unnecessary quoted-pair requires knowing which response fields
  // are quoted-string typed and parsing their grammar; there is no dependable
  // curated set, so scanning arbitrary field values for backslashes would
  // produce false positives.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.4')
  .description(
    'A sender SHOULD NOT generate a quoted-pair in a quoted-string except where necessary to quote DQUOTE and backslash octets occurring within that string.',
  )
  .summary(
    'Sender SHOULD NOT generate quoted-pairs in quoted-strings except to quote DQUOTE and backslash.',
  )
  .done();
