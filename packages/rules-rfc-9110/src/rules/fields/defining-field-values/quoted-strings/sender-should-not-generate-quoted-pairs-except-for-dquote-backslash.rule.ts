import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-not-generate-quoted-pairs-except-for-dquote-backslash',
)
  .severity('warn')
  // Informational: flagging an "unnecessary" quoted-pair requires reliably
  // locating quoted-strings inside arbitrary field values, which in turn
  // requires per-field grammar knowledge (only some fields define
  // quoted-string syntax, and a backslash is ordinary data elsewhere). The
  // framework exposes no per-field grammar registry, so a generic scan would
  // misfire on legitimate values. Honestly deferred to informational rather
  // than shipping an unsound check. Recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.4')
  .description(
    'A sender SHOULD NOT generate a quoted-pair in a quoted-string except where necessary to quote DQUOTE and backslash octets occurring within that string.',
  )
  .summary(
    'Sender SHOULD NOT generate quoted-pairs in quoted-strings except to quote DQUOTE and backslash.',
  )
  .done();
