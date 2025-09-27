import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-may-use-location-header-for-automatic-redirection-for-308-response',
)
  .severity('hint')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-308-permanent-redirect',
  )
  .description(
    'The user agent MAY use the Location field value for automatic redirection.',
  )
  .appliesTo('user-agent')
  .done();
