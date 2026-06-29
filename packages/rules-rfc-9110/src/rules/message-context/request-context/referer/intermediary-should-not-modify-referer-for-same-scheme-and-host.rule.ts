import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-should-not-modify-referer-for-same-scheme-and-host',
)
  .severity('hint')
  // Informational (#327): detecting a *modification* requires comparing the
  // Referer value as it entered the intermediary against the value it forwarded
  // — i.e. correlating the same message at two hops. That cross-hop view is not
  // reconstructable from a standard captured transaction / HAR, so this is not
  // turned into an analytics check. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-referer')
  .description(
    'An intermediary SHOULD NOT modify or delete the Referer header field when the field value shares the same scheme and host as the target URI.',
  )
  .appliesTo('intermediary')
  .done();
