import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-should-not-modify-referer-for-same-scheme-and-host',
)
  .severity('hint')
  // Detecting an intermediary "modifying" Referer requires comparing the field
  // value across adjacent proxy hops. This is a candidate for a captured-trace
  // analytics check, but only where per-hop recorded traffic with intermediary
  // role is available.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'An intermediary SHOULD NOT modify or delete the Referer header field when the field value shares the same scheme and host as the target URI.',
  )
  .appliesTo('intermediary')
  .done();
