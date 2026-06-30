import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-may-use-location-field-for-automatic-redirect',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-300-multiple-choices')
  .description(
    'The user agent MAY use the Location field value for automatic redirection.',
  )
  .appliesTo('user-agent')
  .done();
