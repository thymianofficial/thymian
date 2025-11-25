import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-may-redirect-to-location-header-uri-for-3xx-response',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-redirection-3xx')
  .appliesTo('user-agent')
  .description(
    'If a Location header field is provided, the user agent MAY automatically redirect its request to the URI referenced by the Location field value, even if the specific status code is not understood. Automatic redirection needs to be done with care for methods not known to be safe, as defined in Section 9.2.1, since the user might not wish to redirect an unsafe request.',
  )
  .summary('Clients MAY use the location headers URI for redirection.')
  .done();
