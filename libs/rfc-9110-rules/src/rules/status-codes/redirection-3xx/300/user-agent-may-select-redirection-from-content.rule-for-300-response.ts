import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-may-select-redirection-from-content'
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-300-multiple-choices')
  .description(
    'The user agent MAY make a selection from that list automatically if it understands the provided media type.'
  )
  .appliesTo('user-agent')
  .done();
