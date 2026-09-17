import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-should-not-modify-referer-for-same-scheme-and-host',
)
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    'Detecting an intermediary modifying Referer requires comparing the field value across adjacent proxy hops, which is not observable from a single vantage point.',
  )
  .tags('privacy:referrer')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'An intermediary SHOULD NOT modify or delete the Referer header field when the field value shares the same scheme and host as the target URI.',
  )
  .appliesTo('intermediary')
  .done();
