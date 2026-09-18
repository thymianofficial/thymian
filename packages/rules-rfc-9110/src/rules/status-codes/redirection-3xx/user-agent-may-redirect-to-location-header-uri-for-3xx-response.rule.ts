import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-redirect-to-location-header-uri-for-3xx-response',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A user agent that takes this up sends a follow-up request to the Location value of any 3xx, understood status code or not, which a captured trace carries as a later transaction whose target is that URI. The hint — a redirect carrying a Location that was never followed — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-redirection-3xx')
  .appliesTo('user-agent')
  .description(
    'If a Location header field is provided, the user agent MAY automatically redirect its request to the URI referenced by the Location field value, even if the specific status code is not understood. Automatic redirection needs to be done with care for methods not known to be safe, as defined in Section 9.2.1, since the user might not wish to redirect an unsafe request.',
  )
  .summary('Clients MAY use the location headers URI for redirection.')
  .done();
